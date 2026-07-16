import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/**
 * POST: Create a new brokerage account for a family member
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      memberId,
      broker,
      accountName,
      accountNo,
      appKey,
      secretKey,
      cashKRW,
      cashUSD,
    } = body;

    if (!memberId) {
      return NextResponse.json({ success: false, error: "구성원 ID(memberId)가 필요합니다." }, { status: 400 });
    }
    if (!broker || !broker.trim()) {
      return NextResponse.json({ success: false, error: "증권사 명칭(broker)이 필요합니다." }, { status: 400 });
    }
    if (!accountName || !accountName.trim()) {
      return NextResponse.json({ success: false, error: "계좌 별칭(accountName)이 필요합니다." }, { status: 400 });
    }
    if (!accountNo || !accountNo.trim()) {
      return NextResponse.json({ success: false, error: "계좌번호(accountNo)가 필요합니다." }, { status: 400 });
    }

    const finalAppKey = appKey && appKey.trim() ? appKey.trim() : "mock";
    const finalSecretKey = secretKey && secretKey.trim() ? secretKey.trim() : "mock";

    const encryptedAppKey = encrypt(finalAppKey);
    const encryptedSecretKey = encrypt(finalSecretKey);

    const newAccount = await prisma.account.create({
      data: {
        memberId: parseInt(memberId, 10),
        broker: broker.trim(),
        accountName: accountName.trim(),
        accountNo: accountNo.trim(),
        appKey: encryptedAppKey,
        secretKey: encryptedSecretKey,
        cashKRW: cashKRW ? parseFloat(cashKRW) : 0.0,
        cashUSD: cashUSD ? parseFloat(cashUSD) : 0.0,
      },
    });

    return NextResponse.json({ success: true, account: newAccount });
  } catch (error) {
    console.error("POST Account API Error:", error);
    return NextResponse.json({ success: false, error: "계좌 추가 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * DELETE: Delete a brokerage account
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get("id");

    if (!idStr) {
      return NextResponse.json({ success: false, error: "계좌 ID가 필요합니다." }, { status: 400 });
    }

    const id = parseInt(idStr, 10);

    await prisma.account.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Account API Error:", error);
    return NextResponse.json({ success: false, error: "계좌 삭제 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
