import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * API: /api/members
 * 
 * Flow:
 * 1. Checks if Member table is empty.
 * 2. If empty: Seeds default mock family data (아빠, 엄마, 나).
 * 3. Returns the list of family members.
 */
export async function GET() {
  try {
    let members = await prisma.member.findMany({
      orderBy: { id: "asc" },
    });

    // Auto-seeding if the DB is empty
    if (members.length === 0) {
      console.log("🌱 [Seeding] Empty database detected. Seeding default mock data...");
      await seedDefaultMockData();

      // Refetch members list to return
      members = await prisma.member.findMany({
        orderBy: { id: "asc" },
      });
    }

    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error("GET Members API Error:", error);
    return NextResponse.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * POST: Create a new family member
 */
export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || name.trim() === "") {
      return NextResponse.json({ success: false, error: "이름을 입력해주세요." }, { status: 400 });
    }

    // Check if member already exists
    const existing = await prisma.member.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: "이미 존재하는 구성원입니다." }, { status: 400 });
    }

    const newMember = await prisma.member.create({
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true, member: newMember });
  } catch (error) {
    console.error("POST Members API Error:", error);
    return NextResponse.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * DELETE: Delete a member (cascade deletes accounts, balances)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get("id");

    if (!idStr) {
      return NextResponse.json({ success: false, error: "구성원 ID가 필요합니다." }, { status: 400 });
    }

    const id = parseInt(idStr, 10);

    // Delete the member (cascade deletes accounts, balances, etc. due to onDelete: Cascade in prisma schema)
    await prisma.member.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Members API Error:", error);
    return NextResponse.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * Fallback seeder creating mock family data if family.json is not present
 */
async function seedDefaultMockData() {
  const mockKey = encrypt("mock");

  // Seed Member: 나 (Self) as the sole starting member
  await prisma.member.create({
    data: {
      name: "나",
      accounts: {
        create: [
          {
            broker: "KB증권",
            accountName: "국내 연금저축계좌",
            appKey: mockKey,
            secretKey: mockKey,
            accountNo: "301-2245-8122-01",
            cashKRW: 5400000,
            balances: {
              createMany: {
                data: [
                  { ticker: "005930", stockName: "삼성전자", quantity: 150, avgBuyPrice: 71500, currentPrice: 74200, currency: "KRW" },
                  { ticker: "000660", stockName: "SK하이닉스", quantity: 45, avgBuyPrice: 161000, currentPrice: 168200, currency: "KRW" },
                ],
              },
            },
          },
          {
            broker: "나무증권",
            accountName: "미국주식 해외계좌",
            appKey: mockKey,
            secretKey: mockKey,
            accountNo: "82-1200-449-11",
            cashUSD: 1200.5,
            balances: {
              createMany: {
                data: [
                  { ticker: "AAPL", stockName: "Apple Inc.", quantity: 80, avgBuyPrice: 172.5, currentPrice: 181.2, currency: "USD" },
                  { ticker: "TSLA", stockName: "Tesla Inc.", quantity: 35, avgBuyPrice: 198.0, currentPrice: 174.5, currency: "USD" },
                ],
              },
            },
          },
        ],
      },
    },
  });

  console.log("🌱 [Seeding] Default mock seeding finished successfully with sole member '나'.");
}
