"use server";

import {
  createEntryFromForm,
  deleteEntryById,
  updateEntryFromForm,
} from "@/lib/data/entry-mutations";

export async function createEntry(formData: FormData) {
  return createEntryFromForm(formData);
}

export async function updateEntry(formData: FormData) {
  return updateEntryFromForm(formData);
}

export async function deleteEntry(id: string) {
  return deleteEntryById(id);
}
