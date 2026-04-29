import type { NextFunction, Request, Response } from "express";

type Handler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
