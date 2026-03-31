"""Utilities for scraping recipe data from external URLs via JSON-LD structured data."""
import json
import re
from html.parser import HTMLParser

import httpx

from app.schemas.recipe import RecipeExportIngredient


_KNOWN_UNITS = {
    "g", "kg", "mg",
    "ml", "l", "cl", "dl",
    "el", "tl",
    "stück", "stk", "stk.",
    "prise", "bund", "tasse",
    "becher", "packung", "pck.", "pck", "pkg.", "pkg", "pkt.",
    "dose", "glas", "zweig", "zehe", "scheibe", "blatt", "handvoll",
}

_NUMBER_RE = re.compile(r'^(\d+(?:[.,]\d+)?)\s*(.*)', re.DOTALL)


class _JsonLdExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._in_block = False
        self.blocks: list[str] = []
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type") == "application/ld+json":
            self._in_block = True
            self._buf = []

    def handle_endtag(self, tag):
        if tag == "script" and self._in_block:
            self._in_block = False
            self.blocks.append("".join(self._buf))

    def handle_data(self, data):
        if self._in_block:
            self._buf.append(data)


def find_recipe_jsonld(data) -> dict | None:
    """Recursively find a @type: Recipe object in JSON-LD data."""
    if isinstance(data, list):
        for item in data:
            result = find_recipe_jsonld(item)
            if result:
                return result
    elif isinstance(data, dict):
        type_val = data.get("@type", "")
        if isinstance(type_val, str) and type_val.lower() == "recipe":
            return data
        if isinstance(type_val, list) and any(t.lower() == "recipe" for t in type_val):
            return data
        if "@graph" in data:
            return find_recipe_jsonld(data["@graph"])
    return None


def parse_instructions(raw) -> str | None:
    """Extract plain text from recipeInstructions (string, list of strings or HowToStep dicts)."""
    if not raw:
        return None
    if isinstance(raw, str):
        return raw.strip() or None
    steps = []
    for i, item in enumerate(raw, 1):
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = (item.get("text") or "").strip()
        else:
            continue
        if text:
            steps.append(f"{i}. {text}")
    return "\n".join(steps) or None


def parse_iso_duration(duration: str) -> int | None:
    """Convert ISO 8601 duration (e.g. PT1H30M) to minutes."""
    if not duration:
        return None
    match = re.fullmatch(r'P(?:T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?', duration.upper())
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    total = hours * 60 + minutes
    return total if total > 0 else None


def parse_ingredients(raw_lines: list) -> list[RecipeExportIngredient]:
    """Parse a list of raw ingredient strings into RecipeExportIngredient objects."""
    result: list[RecipeExportIngredient] = []
    for line in raw_lines:
        line = str(line).strip()
        if not line:
            continue
        m = _NUMBER_RE.match(line)
        if m:
            amount = float(m.group(1).replace(",", "."))
            rest = m.group(2).strip()
            first_word, _, remainder = rest.partition(" ")
            if first_word.lower().rstrip(".") in _KNOWN_UNITS and remainder:
                result.append(
                    RecipeExportIngredient(ingredient_name=remainder.strip(), amount=amount, unit=first_word)
                )
            else:
                result.append(
                    RecipeExportIngredient(ingredient_name=rest, amount=amount, unit="Stück")
                )
        else:
            result.append(
                RecipeExportIngredient(ingredient_name=line, amount=1.0, unit="Stück")
            )
    return result


def scrape_recipe_url(url: str) -> dict:
    """Fetch a page and extract recipe data from JSON-LD structured data."""
    resp = httpx.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
    resp.raise_for_status()

    # Detect charset from HTML meta tag to handle pages with ISO-8859-1 / Windows-1252 encoding
    charset_match = re.search(rb'charset=["\']?\s*([^"\'\s;>]+)', resp.content[:4096], re.IGNORECASE)
    if charset_match:
        detected_encoding = charset_match.group(1).decode('ascii', errors='ignore')
        html_text = resp.content.decode(detected_encoding, errors='replace')
    else:
        html_text = resp.text

    parser = _JsonLdExtractor()
    parser.feed(html_text)

    for block in parser.blocks:
        try:
            recipe = find_recipe_jsonld(json.loads(block))
            if recipe:
                return recipe
        except (ValueError, KeyError):
            continue

    raise ValueError("Keine Rezeptdaten (JSON-LD) auf der Seite gefunden")
