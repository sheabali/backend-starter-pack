import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { PaymentController } from "./payment.controller";

const router = express.Router();

// Webhook is handled in app.ts directly to access raw body
// But we still need checkout session creation here

router.post(
  "/checkout",
  auth(UserRole.USER),
  PaymentController.createCheckoutSession
);

export const PaymentRoutes = router;
