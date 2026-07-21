import type { EntryCanvasItem } from "../database.types";

export class EntryCanvasError extends Error {
  readonly status: number;
  readonly latestItem?: EntryCanvasItem;

  constructor(message: string, status = 400, latestItem?: EntryCanvasItem) {
    super(message);
    this.name = "EntryCanvasError";
    this.status = status;
    this.latestItem = latestItem;
  }
}

function isValidationError(error: unknown) {
  return error instanceof Error && error.name === "CanvasValidationError";
}

export function getEntryCanvasErrorStatus(error: unknown) {
  if (error instanceof EntryCanvasError) return error.status;
  if (isValidationError(error)) return 400;
  return 500;
}

export function getEntryCanvasErrorMessage(error: unknown) {
  if (error instanceof EntryCanvasError || isValidationError(error)) {
    return (error as Error).message;
  }
  return "画板服务暂时不可用，请稍后再试。";
}

export function getEntryCanvasConflictItem(error: unknown) {
  return error instanceof EntryCanvasError ? error.latestItem : undefined;
}
