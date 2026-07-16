import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PUT: Update uninvested cash (KRW and USD) for a brokerage account
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { accountId, cashKRW, cashUSD } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId가 필요합니다." }, { status: 400 });
    }

    const updateData: Record<string, number> = {};
    if (cashKRW !== undefined) {
      updateData.cashKRW = parseFloat(cashKRW);
    }
    if (cashUSD !== undefined) {
      updateData.cashUSD = parseFloat(cashUSD);
    }

    const account = await prisma.account.update({
      where: { id: parseInt(accountId, 10) },
      data: updateData,
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error("PUT Account Cash API Error:", error);
    return NextResponse.json({ success: false, error: "예수금 정보 수정 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
