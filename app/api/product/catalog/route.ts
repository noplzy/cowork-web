import { NextResponse } from "next/server";
import { publicProductCatalogPayload } from "@/lib/productCatalog";
export const runtime = "nodejs";
export async function GET() { return NextResponse.json(publicProductCatalogPayload()); }
