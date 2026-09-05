import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://vorta-app.netlify.app",
  "https://main--vorta-app.netlify.app",
  "https://pilot-live--vorta-app.netlify.app",
  "https://vorta.network",
  "https://www.vorta.network",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);
const MANAGER_ROLES = new Set(["vorta_admin","site_admin","maintenance_manager","engineering_manager","reliability_engineer","team_leader"]);
function roleKey(value: unknown): string { return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g,"_") : ""; }
function allowedOrigin(origin: string | null): boolean { if (!origin) return true; return ORIGINS.has(origin) || /^https:\/\/deploy-preview-\d+--vorta-app\.netlify\.app$/.test(origin); }
function headers(req: Request): Record<string,string> { const origin=req.headers.get("origin"); return {"Content-Type":"application/json","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey","Access-Control-Max-Age":"86400",Vary:"Origin",...(origin&&allowedOrigin(origin)?{"Access-Control-Allow-Origin":origin}:{})}; }
function json(req: Request, body: unknown, status=200): Response { return new Response(JSON.stringify(body),{status,headers:headers(req)}); }

Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS") return new Response(null,{status:allowedOrigin(req.headers.get("origin"))?204:403,headers:headers(req)});
  if(req.method!=="POST") return json(req,{error:"Method not allowed"},405);
  try {
    const authorization=req.headers.get("authorization"); const url=Deno.env.get("SUPABASE_URL"); const anonKey=Deno.env.get("SUPABASE_ANON_KEY"); const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!authorization||!url||!anonKey||!serviceRoleKey) return json(req,{error:"Authentication required"},401);
    const token=authorization.replace(/^Bearer\s+/i,"").trim(); const authClient=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}}); const {data:userResult,error:userError}=await authClient.auth.getUser(token); const user=userResult.user;
    if(userError||!user) return json(req,{error:"Authentication could not be verified"},401);
    const payload=await req.json().catch(()=>({})); const requestedSiteId=typeof payload?.siteId==="string"?payload.siteId.trim():"";
    const db=createClient(url,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:profile,error:profileError}=await db.from("profiles").select("id,organisation_id,role").eq("id",user.id).maybeSingle(); if(profileError||!profile?.organisation_id) return json(req,{error:"Portal access could not be verified"},403);
    let accessQuery=db.from("user_site_access").select("site_id,organisation_id,app_role,active").eq("user_id",user.id).eq("organisation_id",profile.organisation_id).eq("active",true);
    if(requestedSiteId) accessQuery=accessQuery.eq("site_id",requestedSiteId);
    const {data:accessRows,error:accessError}=await accessQuery.limit(3); if(accessError) throw accessError;
    if(!accessRows?.length) return json(req,{error:"Active site access is required"},403);
    if(!requestedSiteId && accessRows.length!==1) return json(req,{error:"A siteId is required when more than one site is accessible"},400);
    const access=accessRows[0]; const siteId=String(access.site_id); const role=roleKey(access.app_role??profile.role); const manager=MANAGER_ROLES.has(role);
    const {data:assessorEngineer}=await db.from("engineers").select("id,site_id,organisation_id").eq("profile_id",user.id).eq("site_id",siteId).eq("organisation_id",profile.organisation_id).maybeSingle();
    if(!manager && !assessorEngineer?.id) return json(req,{error:"Authorised manager or qualified peer access is required"},403);

    const {data:pendingRows,error:pendingError}=await db.from("equipment_competency_assessments").select("id,site_id,equipment_id,engineer_id,assessment_level,evidence_reference,notes,assessed_at,created_at").eq("site_id",siteId).eq("assessment_status","pending").order("assessed_at",{ascending:true});
    if(pendingError) throw pendingError;
    const pending=pendingRows??[]; if(!pending.length) return json(req,{siteId,reviewerRole:role,items:[],generatedAt:new Date().toISOString()});
    const equipmentIds=[...new Set(pending.map((row:any)=>String(row.equipment_id)))]; const engineerIds=[...new Set(pending.map((row:any)=>String(row.engineer_id)))];
    const [equipmentResult,engineerResult,capabilityResult]=await Promise.all([
      db.from("equipment_assets").select("id,name,equipment_code,area").in("id",equipmentIds).eq("site_id",siteId),
      db.from("engineers").select("id,full_name,discipline").in("id",engineerIds).eq("site_id",siteId),
      !manager&&assessorEngineer?.id ? db.from("equipment_engineer_capabilities").select("equipment_id,competency_level,capability_status,validation_status,practice_authority,valid_from,valid_until").eq("engineer_id",assessorEngineer.id).in("equipment_id",equipmentIds) : Promise.resolve({data:[],error:null}),
    ]);
    const detailError=equipmentResult.error??engineerResult.error??capabilityResult.error; if(detailError) throw detailError;
    const equipmentMap=new Map((equipmentResult.data??[]).map((row:any)=>[String(row.id),row])); const engineerMap=new Map((engineerResult.data??[]).map((row:any)=>[String(row.id),row])); const capabilityMap=new Map((capabilityResult.data??[]).map((row:any)=>[String(row.equipment_id),row])); const today=new Date().toISOString().slice(0,10);
    const items=pending.flatMap((assessment:any)=>{
      if(assessorEngineer?.id===assessment.engineer_id) return [];
      let reviewerAuthority=role.toUpperCase();
      if(!manager){ const capability:any=capabilityMap.get(String(assessment.equipment_id)); if(!capability) return []; const current=capability.capability_status==="ACTIVE"&&capability.validation_status==="VALIDATED"&&(!capability.valid_from||capability.valid_from<=today)&&(!capability.valid_until||capability.valid_until>=today); const level=Number(assessment.assessment_level); const authorityOkay=level>=4?capability.practice_authority==="AUTHORISER":["INDEPENDENT","AUTHORISER"].includes(capability.practice_authority); if(!current||Number(capability.competency_level)<level||!authorityOkay) return []; reviewerAuthority="QUALIFIED_PEER"; }
      const equipment:any=equipmentMap.get(String(assessment.equipment_id)); const engineer:any=engineerMap.get(String(assessment.engineer_id)); if(!equipment||!engineer) return [];
      return [{id:assessment.id,equipment:{id:equipment.id,name:equipment.name,equipmentCode:equipment.equipment_code,area:equipment.area},engineer:{id:engineer.id,name:engineer.full_name,discipline:engineer.discipline},proposedLevel:Number(assessment.assessment_level),evidenceReference:assessment.evidence_reference??null,notes:assessment.notes??null,submittedAt:assessment.assessed_at??assessment.created_at,reviewerAuthority}];
    });
    return json(req,{siteId,reviewerRole:role,items,generatedAt:new Date().toISOString()});
  } catch(error){ console.error("equipment-competency-review-data failed",error); return json(req,{error:"Competency review queue could not be loaded"},500); }
});
