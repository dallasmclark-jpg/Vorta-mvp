import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const [metricsResult, insightsResult] = await Promise.all([
    supabase
      .from("ai_dashboard_metrics")
      .select(
        "metric_category,metric_name,metric_value,metric_unit,trend_direction,trend_percentage,status"
      ),
    supabase
      .from("ai_insights")
      .select(
        "id,title,severity,confidence_score,urgency_score,status,recommended_action,source_module"
      )
      .eq("status", "open")
      .order("urgency_score", { ascending: false }),
  ]);

  return new Response(
    JSON.stringify({
      metrics: metricsResult.data ?? [],
      insights: insightsResult.data ?? [],
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
