/**
 * A folder URL with its `lang=` removed, so the language passed alongside it is
 * the one IS answers in. Folder URLs come off the Czech subjects page carrying
 * `lang=cz`, and fetchFilesFromFolder keeps a lang it finds — so an English
 * student's files were fetched in Czech and stamped English.
 */
export function withoutLang(url: string): string {
  return url.replace(/([?;&])lang=[a-z]{2}([;&])?/, (_m, sep: string, next?: string) =>
    next ? sep : ''
  );
}
