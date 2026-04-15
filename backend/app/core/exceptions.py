class AppException(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code


class AuthenticationError(AppException):
    def __init__(self, detail: str = "Invalid credentials"):
        super().__init__(detail=detail, status_code=401)


class ForbiddenError(AppException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(detail=detail, status_code=403)


class ConflictError(AppException):
    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(detail=detail, status_code=409)


class NotFoundError(AppException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(detail=detail, status_code=404)


class RateLimitError(AppException):
    def __init__(self, detail: str = "Rate limit exceeded. Try again later."):
        super().__init__(detail=detail, status_code=429)
