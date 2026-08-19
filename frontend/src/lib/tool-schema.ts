/**
 * Parse a pasted or uploaded tool schema into the draft rows the form edits.
 *
 * Nobody defining an agent has their tools as a list of names and one-line
 * descriptions — they have a JSON schema, an OpenAI `tools` array, or an MCP
 * listing. Retyping that into a form is the kind of thing that makes a product
 * feel like a demo, so every common shape is accepted:
 *
 *   [{type:"function", function:{name, description, parameters}}]   OpenAI
 *   [{name, description, input_schema}]                             Anthropic / MCP
 *   {toolName: {description, parameters}}                           Aegis native
 *   [{name, description}]                                           a plain list
 *
 * Risk is left for the caller to infer, because the backend does that better from
 * the tool's verb than any hand-written label.
 */
import type { RiskLevel } from "./types";

export interface ParsedTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  risk?: RiskLevel;
}

export interface ParseResult {
  tools: ParsedTool[];
  errors: string[];
}

const RISKS: RiskLevel[] = ["low", "medium", "high"];

function asRisk(value: unknown): RiskLevel | undefined {
  const text = String(value ?? "").toLowerCase();
  if (text === "critical") return "high";        // the UI scale stops at high
  return RISKS.includes(text as RiskLevel) ? (text as RiskLevel) : undefined;
}

function one(entry: unknown, errors: string[], index: number): ParsedTool | null {
  if (!entry || typeof entry !== "object") {
    errors.push(`Entry ${index + 1} is not an object.`);
    return null;
  }
  const record = entry as Record<string, unknown>;

  // OpenAI wraps the real definition one level down.
  const inner = record["function"] && typeof record["function"] === "object"
    ? (record["function"] as Record<string, unknown>)
    : record;

  const name = String(inner["name"] ?? "").trim();
  if (!name) {
    errors.push(`Entry ${index + 1} has no name.`);
    return null;
  }
  const parameters = (inner["parameters"] ?? inner["input_schema"] ?? inner["inputSchema"]) as
    | Record<string, unknown>
    | undefined;

  return {
    name,
    description: String(inner["description"] ?? "").trim(),
    ...(parameters && typeof parameters === "object" ? { parameters } : {}),
    ...(asRisk(inner["risk"] ?? inner["danger_level"])
      ? { risk: asRisk(inner["risk"] ?? inner["danger_level"])! }
      : {}),
  };
}

export function parseToolSchema(input: string): ParseResult {
  const errors: string[] = [];
  const text = input.trim();
  if (!text) return { tools: [], errors: ["Nothing to import."] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return {
      tools: [],
      errors: [`Not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`],
    };
  }

  // Unwrap the common envelopes: {tools:[...]}, {functions:[...]}, {result:{tools:[...]}}
  let body = parsed;
  for (const key of ["tools", "functions", "result"]) {
    if (body && typeof body === "object" && !Array.isArray(body)
        && key in (body as Record<string, unknown>)) {
      body = (body as Record<string, unknown>)[key];
    }
  }

  let entries: unknown[];
  if (Array.isArray(body)) {
    entries = body;
  } else if (body && typeof body === "object") {
    // A name -> definition map, the shape Aegis itself stores.
    entries = Object.entries(body as Record<string, unknown>).map(([name, value]) => ({
      name,
      ...(value && typeof value === "object" ? (value as Record<string, unknown>) : {}),
    }));
  } else {
    return { tools: [], errors: ["Expected an array of tools or an object keyed by tool name."] };
  }

  const tools: ParsedTool[] = [];
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    const tool = one(entry, errors, index);
    if (!tool) return;
    if (seen.has(tool.name)) {
      errors.push(`Duplicate tool "${tool.name}" ignored.`);
      return;
    }
    seen.add(tool.name);
    tools.push(tool);
  });

  if (!tools.length && !errors.length) errors.push("No tools found in that schema.");
  return { tools, errors };
}

/** Round-trips the draft rows back out, so what you import you can also copy. */
export function toolsToJson(tools: ParsedTool[]): string {
  return JSON.stringify(
    tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      ...(tool.parameters ? { parameters: tool.parameters } : {}),
    })),
    null,
    2,
  );
}
