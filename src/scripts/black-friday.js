import { applyPromoWindows, promoNow } from "./promo-windows.js";

applyPromoWindows(document, promoNow(window.location.search));
