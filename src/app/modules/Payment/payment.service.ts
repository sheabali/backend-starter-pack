import Stripe from "stripe";
import config from "../../../config";
import prisma from "../../../lib/prisma";
import { Plan, SubscriptionStatus } from "@prisma/client";

const stripe = new Stripe(config.stripe.secret_key as string);

const createCheckoutSession = async (userId: string, planType: "PRO" | "PAY_PER_REPORT"): Promise<any> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  let sessionParams: any = {
    payment_method_types: ["card"],
    customer_email: user.email,
    line_items: [],
    mode: planType === "PRO" ? "subscription" : "payment",
    success_url: `${config.frontend_url}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontend_url}/analyzer`,
    metadata: {
      userId,
      planType,
    },
  };

  if (planType === "PRO") {
    sessionParams.line_items?.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "CareerAI Pro Subscription",
          description: "Unlimited AI analyses and premium features",
        },
        unit_amount: 500, // $5.00
        recurring: {
          interval: "month",
        },
      },
      quantity: 1,
    });
  } else {
    sessionParams.line_items?.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Single Analysis Report",
          description: "One-time AI resume analysis credit",
        },
        unit_amount: 200, // $2.00
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
};

const handleWebhook = async (req: any): Promise<void> => {
  const session = req.data.object as any;

  switch (req.type) {
    case "checkout.session.completed": {
      const userId = session.metadata?.userId;
      const planType = session.metadata?.planType as "PRO" | "PAY_PER_REPORT";

      if (!userId) break;

      if (planType === "PRO") {
        // Update user plan to PRO
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: Plan.PRO,
            creditsRemaining: 999, // Effectively unlimited
            subscriptionStatus: SubscriptionStatus.ACTIVE,
          },
        });

        // Create Subscription record
        await prisma.subscription.create({
          data: {
            userId,
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            planType: Plan.PRO,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            // Set currentPeriodEnd to 1 month from now (approximate, webhook for subscription.updated will refine this)
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      } else if (planType === "PAY_PER_REPORT") {
        // Add one analysis credit
        await prisma.user.update({
          where: { id: userId },
          data: {
            creditsRemaining: { increment: 1 },
          },
        });
      }

      // Create Payment record
      await prisma.payment.create({
        data: {
          stripePaymentId: session.payment_intent as string || session.id,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "USD",
          status: "COMPLETED",
          planType: planType as Plan,
          customerEmail: session.customer_details?.email || "",
          paidAt: new Date(),
        },
      });

      // Log activity
      const { AnalyticsService } = require("../../../services/analytics.service");
      if (planType === "PRO") {
        AnalyticsService.logActivity(userId, "USER_UPGRADED", "User upgraded to Pro plan", {
          amount: (session.amount_total || 0) / 100,
          currency: session.currency,
        });
      }
      AnalyticsService.logActivity(userId, "PAYMENT_PROCESSED", `Payment processed for ${planType}`, {
        amount: (session.amount_total || 0) / 100,
        currency: session.currency,
      });

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = req.data.object as any;
      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (dbSubscription) {
        await prisma.user.update({
          where: { id: dbSubscription.userId },
          data: {
            plan: Plan.FREE,
            creditsRemaining: 3,
            subscriptionStatus: SubscriptionStatus.EXPIRED,
          },
        });

        await prisma.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: SubscriptionStatus.EXPIRED,
            cancelledAt: new Date(),
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = req.data.object as any;
      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (dbSubscription) {
        await prisma.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: subscription.status === "active" ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAST_DUE,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
      }
      break;
    }
  }
};

export const PaymentService = {
  createCheckoutSession,
  handleWebhook,
};
