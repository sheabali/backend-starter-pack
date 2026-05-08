import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { PaymentService } from "./payment.service";
import Stripe from "stripe";
import config from "../../../config";

const stripe = new Stripe(config.stripe.secret_key as string);

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { planType } = req.body;

  const result = await PaymentService.createCheckoutSession(userId, planType);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Checkout session created successfully",
    data: result,
  });
});

const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = config.stripe.webhook_secret;

  let event: any; // Using any or Stripe.Event depending on compiler setup

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // This must be the raw body
      sig,
      webhookSecret as string
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await PaymentService.handleWebhook(event);
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`Webhook Processing Error: ${err.message}`);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

export const PaymentController = {
  createCheckoutSession,
  handleWebhook,
};
