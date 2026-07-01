import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

/**
 * API: /api/members
 * 
 * Flow:
 * 1. Checks if Member table is empty.
 * 2. If empty, automatically seeds realistic family members and mock accounts
 *    so the project is 100% interactive and working right out of the box!
 * 3. Returns the list of family members.
 */
export async function GET() {
  try {
    let members = await prisma.member.findMany({
      orderBy: { id: "asc" },
    });

    // Auto-seeding if the DB is empty
    if (members.length === 0) {
      console.log("🌱 [Seeding] Empty database detected. Auto-seeding default family members...");

      // Encrypt mock keys to ensure secure, clean entries in DB
      const mockKey = encrypt("mock");

      // Seed Member 1: 아빠 (Father)
      const father = await prisma.member.create({
        data: {
          name: "아빠",
          accounts: {
            create: {
              broker: "KB증권",
              accountName: "국내 연금저축계좌",
              appKey: mockKey,
              secretKey: mockKey,
              accountNo: "301-2245-8122-01",
              balances: {
                createMany: {
                  data: [
                    { ticker: "005930", stockName: "삼성전자", quantity: 150, avgBuyPrice: 71500, currentPrice: 74200, currency: "KRW" },
                    { ticker: "000660", stockName: "SK하이닉스", quantity: 45, avgBuyPrice: 161000, currentPrice: 168200, currency: "KRW" },
                  ],
                },
              },
            },
          },
        },
      });

      // Seed Member 2: 엄마 (Mother)
      const mother = await prisma.member.create({
        data: {
          name: "엄마",
          accounts: {
            create: {
              broker: "나무증권",
              accountName: "미국주식 해외계좌",
              appKey: mockKey,
              secretKey: mockKey,
              accountNo: "82-1200-449-11",
              balances: {
                createMany: {
                  data: [
                    { ticker: "AAPL", stockName: "Apple Inc.", quantity: 80, avgBuyPrice: 172.5, currentPrice: 181.2, currency: "USD" },
                    { ticker: "TSLA", stockName: "Tesla Inc.", quantity: 35, avgBuyPrice: 198.0, currentPrice: 174.5, currency: "USD" },
                  ],
                },
              },
            },
          },
        },
      });

      // Seed Member 3: 나 (Self)
      const me = await prisma.member.create({
        data: {
          name: "나",
          accounts: {
            create: {
              broker: "토스증권",
              accountName: "국내 단기투자계좌",
              appKey: mockKey,
              secretKey: mockKey,
              accountNo: "1002-441-2901-5",
              balances: {
                createMany: {
                  data: [
                    { ticker: "035420", stockName: "NAVER", quantity: 20, avgBuyPrice: 188000, currentPrice: 195000, currency: "KRW" },
                    { ticker: "035720", stockName: "카카오", quantity: 110, avgBuyPrice: 51200, currentPrice: 48900, currency: "KRW" },
                  ],
                },
              },
            },
          },
        },
      });

      console.log("🌱 [Seeding] Auto-seeding finished successfully.");
      
      // Refetch after seeding
      members = [father, mother, me];
    }

    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error("GET Members API Error:", error);
    return NextResponse.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
