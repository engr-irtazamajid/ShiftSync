import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserModel, UserDocument } from "../../models/User";
import { env } from "../../config/env";
import { AppError } from "../../middleware/AppError";
import { signAccessToken } from "../../middleware/authenticate";

const REFRESH_TOKEN_SALT_ROUNDS = 10;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function issueTokenPair(user: UserDocument): TokenPair {
  const managedLocationIds = user.managedLocationIds.map((id) => id.toString());
  const accessToken = signAccessToken({
    sub: user.id.toString(),
    role: user.role,
    managedLocationIds,
  });
  const refreshToken = jwt.sign({ sub: user.id.toString() }, env.refreshTokenSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });
  return { accessToken, refreshToken };
}

export async function login(
  email: string,
  password: string
): Promise<{ tokens: TokenPair; user: UserDocument }> {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash +refreshTokenHash"
  );
  if (!user || !user.isActive) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const tokens = issueTokenPair(user);
  user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
  await user.save();

  return { tokens, user };
}

export async function refresh(
  refreshToken: string
): Promise<{ tokens: TokenPair; user: UserDocument }> {
  let payload: { sub: string };
  try {
    payload = jwt.verify(refreshToken, env.refreshTokenSecret) as { sub: string };
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const user = await UserModel.findById(payload.sub).select("+refreshTokenHash");
  if (!user || !user.isActive || !user.refreshTokenHash) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!matches) {
    // possible token reuse after rotation — invalidate the stored hash defensively
    user.refreshTokenHash = null;
    await user.save();
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const tokens = issueTokenPair(user);
  user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
  await user.save();

  return { tokens, user };
}

export async function logout(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $set: { refreshTokenHash: null } });
}

export async function logoutByRefreshToken(refreshToken: string): Promise<void> {
  let payload: { sub: string };
  try {
    payload = jwt.verify(refreshToken, env.refreshTokenSecret) as { sub: string };
  } catch {
    return;
  }
  await logout(payload.sub);
}
