// Reminder ("come back to the app") messages for the Customer Android app.
// 5 slots a day x 4 variants each. The variant changes daily so the same
// text never shows two days running. Times are Nigeria time (WAT, UTC+1).
const SLOTS = {
  breakfast: [
    { title: "Good morning from Fidelx", body: "Hungry? Breakfast from vendors near you is a few taps away." },
    { title: "What's for breakfast?", body: "Order something hot before you leave the house." },
    { title: "Start your day right", body: "Fresh breakfast, delivered. Browse what's open now." },
    { title: "Skipping breakfast?", body: "Don't. Let Fidelx bring it to you." },
    { title: "Rise and shine", body: "Your morning meal is one order away." },
    { title: "Running late?", body: "Skip the queue. Order breakfast and we'll deliver it." },
    { title: "Morning cravings", body: "Pap, akara, bread and more. See who's open near you." },
    { title: "Fuel up for the day", body: "A good breakfast makes a good day. Order on Fidelx." },
    { title: "Breakfast in bed?", body: "Why not. Order from your phone and relax." },
    { title: "New day, new meal", body: "Try something different this morning." },
  ],
  lunch: [
    { title: "Lunchtime!", body: "What are you craving today? Order and we'll deliver." },
    { title: "Hungry yet?", body: "Lunch from your favourite vendors is waiting on Fidelx." },
    { title: "Too busy to go out?", body: "Stay where you are. We'll bring lunch to you." },
    { title: "Midday hunger check", body: "See what's cooking near you right now." },
    { title: "Lunch break?", body: "Make it easy. Order in a few taps." },
    { title: "Craving something good?", body: "Rice, soups, grills and more are ready to order." },
    { title: "Don't wait till you're starving", body: "Order lunch now and it'll be on its way." },
    { title: "Treat yourself today", body: "You deserve a good lunch. Browse vendors near you." },
    { title: "Sharing lunch with the team?", body: "Order for everyone in one go." },
    { title: "Hot and ready", body: "Vendors near you are open. See what's on the menu." },
  ],
  afternoon: [
    { title: "Need groceries?", body: "Order groceries and everyday items from Fidelx today." },
    { title: "Running low on something?", body: "Get it delivered without leaving home." },
    { title: "Pharmacy or provisions?", body: "Fidelx delivers essentials to your door." },
    { title: "Afternoon snack?", body: "Something small and tasty is a tap away." },
    { title: "Stock up the kitchen", body: "Fresh produce and provisions, delivered." },
    { title: "Forgot something?", body: "Order it now and skip the trip to the market." },
    { title: "Feeling a little hungry?", body: "A quick bite from a nearby vendor is waiting." },
    { title: "Need something from the pharmacy?", body: "Order health essentials without stepping out." },
    { title: "Plan tonight's meal", body: "Get your ingredients delivered in time for dinner." },
    { title: "Errands done for you", body: "Let Fidelx handle the shopping run today." },
  ],
  dinner: [
    { title: "Dinner sorted?", body: "Order now and relax. We'll handle the rest." },
    { title: "What's for dinner tonight?", body: "Hot meals from vendors near you, delivered." },
    { title: "Too tired to cook?", body: "Let Fidelx bring dinner to you." },
    { title: "Evening cravings", body: "See what's open and order in minutes." },
    { title: "Long day?", body: "You've earned a good dinner. Order and unwind." },
    { title: "Dinner for the family?", body: "Order enough for everyone from vendors near you." },
    { title: "Skip the kitchen tonight", body: "Pick a meal, tap order, relax." },
    { title: "Something hearty tonight?", body: "Browse hot meals ready for delivery." },
    { title: "Hungry after work?", body: "Order on your way home so dinner is waiting." },
    { title: "Try something new", body: "Discover a new vendor for dinner tonight." },
  ],
  night: [
    { title: "Still hungry?", body: "Late-night bites are on Fidelx. Check what's open." },
    { title: "Before you sleep", body: "Order tonight's snack or tomorrow's essentials." },
    { title: "Night owl?", body: "Browse open vendors and get something delivered." },
    { title: "Don't go to bed hungry", body: "A quick order on Fidelx fixes that." },
    { title: "Midnight munchies?", body: "See which vendors are still open near you." },
    { title: "Plan tomorrow's meals", body: "Order groceries tonight and have them ready." },
    { title: "Late-night craving", body: "Something small and satisfying is one tap away." },
    { title: "Wind down with a snack", body: "Order something tasty and enjoy the evening." },
    { title: "Almost bedtime", body: "Need anything delivered before you rest?" },
    { title: "Last call for today", body: "Check what's open and order before the night ends." },
  ],
};

const WAT_OFFSET_MS = 60 * 60 * 1000;

const watDate = (now = Date.now()) => new Date(now + WAT_OFFSET_MS).toISOString().slice(0, 10);

// Same message for everyone in a given slot on a given day; changes next day.
const pickMessage = (slot, now = Date.now()) => {
  const variants = SLOTS[slot];
  if (!variants) return null;
  const dayNumber = Math.floor((now + WAT_OFFSET_MS) / 86400000);
  return variants[dayNumber % variants.length];
};

module.exports = { SLOTS, pickMessage, watDate };
