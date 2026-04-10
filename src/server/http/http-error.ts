// 라우트·서비스에서 HTTP 상태와 함께 던지는 앱 표준 에러
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
