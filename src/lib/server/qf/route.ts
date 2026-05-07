export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isQfAuthenticationErrorMessage(message: string) {
  return (
    message.includes('connection expired') || message.includes('connect your Quran Foundation')
  );
}

export function getQfErrorStatus(error: unknown) {
  return isQfAuthenticationErrorMessage(getErrorMessage(error)) ? 401 : 500;
}
