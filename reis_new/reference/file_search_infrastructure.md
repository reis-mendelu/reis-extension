# Hledání souborů

## Základní workflow

### 1. Získání subject_code

Začni na:
- https://is.mendelu.cz/auth/?lang=cz
- https://is.mendelu.cz/auth/student/list.pl?lang=cz

Zjisti `subject_code` z odkazu:
```html
<a href="/auth/katalog/syllabus.pl?predmet=159410;lang=cz">EBC-ALG Algoritmizace</a>
```

### 2. Otevření dokumentového serveru

Naviguj na:
- https://is.mendelu.cz/auth/dok_server/?_m=229;lang=cz

Otevři složku s odpovídajícím `subject_code`:
```html
<a href="slozka.pl?ds=1;id=150953;lang=cz"><b>EBC-ALG Algoritmizace</b></a>
```

### 3. Případy struktury složky

Existují tři možné případy:

1. **Nejsou žádné soubory** - složka je prázdná
2. **Soubory přímo jako tabulka** - soubory jsou přímo v hlavní složce
3. **Soubory v podsložkách** - soubory jsou organizované v podsložkách se stejnou strukturou

### 4. Procházení podsložek

Pro každou podsložku otevři:
```html
<a href="slozka.pl?;id=152415;lang=cz"><img src="/img.pl?unid=69596" alt="" sysid="base-op"></a>
```

### 5. Práce se soubory

Pro každý soubor:

#### Krok 1: Klikni na zobrazit
```html
<a href="dokumenty_cteni.pl?id=152415;on=0;dok=342004;serializace=158981964:1763914974:120344:user:e3e5cbad1b74d9688de13e85fce564eab42bab2b;lang=cz">
  <img src="/img.pl?unid=71073" alt="" sysid="prohlizeni-info">
</a>
```

#### Krok 2: Stáhni nebo použij pro otevření v blobu (pro PDF)
```html
<a href="/auth/dok_server/slozka.pl?download=342004;id=152415;z=1;lang=cz">
  <img src="/img.pl?unid=70221" alt="tzi-intro.pdf" title="tzi-intro.pdf" sysid="mime-pdf">
</a>
```

## Poznámky

- Vždy používej parametr `;lang=cz` ve všech URL
- Download URL má formát: `/auth/dok_server/slozka.pl?download={dok_id};id={folder_id};z=1;lang=cz`
- Pro otevření v blobu (např. PDF preview) použij download URL
