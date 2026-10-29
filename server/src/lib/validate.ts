import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path?.length ? issue.path.join('.') : 'body';
      res.status(400).json({ error: issue ? `${path}: ${issue.message}` : 'Invalid input' });
      return;
    }
    req.body = result.data;
    next();
  };
}
