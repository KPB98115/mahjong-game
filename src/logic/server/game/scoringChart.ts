import { scoringChartSchema, type ScoringChart } from "../../../model/server/scoringChart";
import { Ruleset } from "../../../types/server/ruleset";
import hongKongChart from "../../../static/ruleset/hongKong.json";
import taiwanChart from "../../../static/ruleset/taiwan.json";

const chartsByRuleset: Record<Ruleset, ScoringChart[]> = {
  [Ruleset.HongKong]: [scoringChartSchema.parse(hongKongChart)],
  [Ruleset.Taiwan]: [scoringChartSchema.parse(taiwanChart)],
};

export function scoringChartFor(ruleset: Ruleset, version: string): ScoringChart | undefined {
  return chartsByRuleset[ruleset].find((chart) => chart.version === version);
}
