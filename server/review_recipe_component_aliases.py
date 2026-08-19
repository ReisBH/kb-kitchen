import concurrent.futures
import json
import os
from collections import defaultdict
from pathlib import Path

from openai import OpenAI


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PREPARATION_PATH = PROJECT_ROOT / "imports" / "recipe_import_preparation.json"
OUTPUT_PATH = Path(os.environ.get("ALIAS_REVIEW_OUTPUT", PROJECT_ROOT / "imports" / "recipe_component_alias_recommendations.json"))
MODEL = os.environ.get("ALIAS_REVIEW_MODEL", "gpt-5-mini")
MAX_WORKERS = 8


def unique_unmatched(preparation: dict) -> list[dict]:
    grouped: dict[str, dict] = {}
    for item in preparation["unresolved"]:
        component = item["component"]
        if component["status"] != "sem_correspondencia":
            continue
        key = component["sourceName"]
        if key not in grouped:
            grouped[key] = {
                "source_name": key,
                "occurrences": 0,
                "source_units": set(),
                "examples": set(),
            }
        grouped[key]["occurrences"] += 1
        grouped[key]["source_units"].add(component["convertedUnit"])
        grouped[key]["examples"].add(item["targetName"])

    return [
        {
            **entry,
            "source_units": sorted(entry["source_units"]),
            "examples": sorted(entry["examples"])[:5],
        }
        for entry in sorted(grouped.values(), key=lambda value: (-value["occurrences"], value["source_name"]))
    ]


def request_one(client: OpenAI, source: dict, articles: list[dict], planned_recipes: list[dict]) -> dict:
    prompt = {
        "task": "Determine whether an Excel food component should be linked to an active KB Kitchen article or to a planned base recipe. This is a recommendation only; never invent a link.",
        "rules": [
            "Choose an article only when it is clearly the same culinary product, accounting for Portuguese, Spanish, English, accents, species names, packaging and common synonyms.",
            "Choose a planned base recipe only when the Excel component unmistakably refers to that prepared base.",
            "If exact identity is uncertain, choose NO_MATCH with low or medium confidence.",
            "Do not choose technical sheets; they will be flattened separately during import.",
            "Quantity units are clues only. A unit mismatch must reduce confidence unless the product identity is indisputable.",
        ],
        "excel_component": source,
        "active_articles": articles,
        "planned_base_recipes": planned_recipes,
    }
    for attempt in range(2):
        try:
            prompt["output_format"] = {
                "reference_type": "article | planned_recipe | NO_MATCH",
                "reference_id": "integer ID or null",
                "reference_name": "selected name or null",
                "confidence": "high | medium | low",
                "rationale": "brief reason",
            }
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are a cautious restaurant inventory data-mapping specialist. Return only valid JSON, with no Markdown or prose outside the JSON object."},
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                max_completion_tokens=300,
            )
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Model returned empty content")
            mapping = json.loads(content)
            mapping["source_name"] = source["source_name"]
            mapping["occurrences"] = source["occurrences"]
            mapping["source_units"] = source["source_units"]
            mapping["examples"] = source["examples"]
            return mapping
        except Exception as error:
            if attempt == 1:
                return {
                    "source_name": source["source_name"],
                    "occurrences": source["occurrences"],
                    "source_units": source["source_units"],
                    "examples": source["examples"],
                    "reference_type": "NO_MATCH",
                    "reference_id": None,
                    "reference_name": None,
                    "confidence": "low",
                    "rationale": f"Recommendation failed: {type(error).__name__}: {str(error)[:240]}",
                }


def main() -> None:
    preparation = json.loads(PREPARATION_PATH.read_text())
    articles = [
        {"id": article["id"], "name": article["name"], "type": article["type"], "unit": article["unit"], "category": article["category"]}
        for article in preparation["articleCatalog"]
    ]
    planned_recipes = [
        {"id": entry["order"], "name": entry["targetName"], "source_name": entry["sourceName"], "unit": "ml" if any(word in entry["targetName"].lower() for word in ["molho", "caldo", "sopa", "oleo", "vinagre", "soja", "tare", "ponzu"]) else "g"}
        for entry in preparation["plannedEntries"]
        if entry["classification"] == "receita_base"
    ]
    source_components = unique_unmatched(preparation)
    limit = int(os.environ.get("ALIAS_REVIEW_LIMIT", "0"))
    if limit > 0:
        source_components = source_components[:limit]
    client = OpenAI()

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        recommendations = list(
            executor.map(
                lambda source: request_one(client, source, articles, planned_recipes),
                source_components,
            )
        )

    summary = defaultdict(int)
    for recommendation in recommendations:
        summary[f"{recommendation['reference_type']}:{recommendation['confidence']}"] += 1

    OUTPUT_PATH.write_text(
        json.dumps(
            {
                "model": MODEL,
                "source_component_count": len(source_components),
                "summary": dict(sorted(summary.items())),
                "recommendations": recommendations,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(json.dumps({"output_path": str(OUTPUT_PATH), "summary": dict(sorted(summary.items()))}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
