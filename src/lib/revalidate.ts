import { revalidatePath } from 'next/cache'

// Public catalogue pages (home, catalog, category, listing) are cached; call
// this after any change to a listing or partner profile so visitors see it
// straight away instead of after the 5-minute refresh.
export function revalidateCatalog() {
  revalidatePath('/', 'layout')
}
