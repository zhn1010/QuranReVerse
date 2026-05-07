export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isQfAuthenticationErrorMessage(message: string) {
  return (
    message.includes('connection expired') || message.includes('connect your Quran Foundation')
  );
}

export function isQfUpstreamTimeoutErrorMessage(message: string) {
  return message.includes('Quran Foundation request timed out');
}

export function getQfErrorStatus(error: unknown) {
  const message = getErrorMessage(error);

  if (isQfAuthenticationErrorMessage(message)) {
    return 401;
  }

  if (isQfUpstreamTimeoutErrorMessage(message)) {
    return 504;
  }

  return 500;
}
