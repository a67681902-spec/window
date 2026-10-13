# TIMO apartment master data

Upload the public Korea Real Estate Board apartment-only file **`apartments_20260831.csv`** to this `data/` directory on branch `timo-updates`.

The file is UTF-8 with BOM, ~7.9 MB, 46,385 housing-type-1 apartment complexes. It was derived from the user-provided 2026-08-31 source. Do not upload private business records here: this repository is public.

Once uploaded, the TIMO extension reads the CSV from `https://raw.githubusercontent.com/a67681902-spec/window/timo-updates/data/apartments_20260831.csv`.

Verified Daegu count: address `대구광역시`, approval years 1991-2008 inclusive, 20-5000 units inclusive => **731 unique complexes**.
