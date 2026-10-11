import {
  ShoppingCart, Coffee, Utensils, Pizza, Sandwich, Apple, Beer, Wine, CupSoda, Cake, Soup, IceCreamCone,
  House, Lightbulb, Plug, Wifi, Smartphone, Droplets, Flame, Sofa, Wrench, Hammer, Trash2, Zap, Phone,
  Car, Fuel, Bus, TrainFront, Plane, Bike, Hotel, Luggage, Map, SquareParking, Ship,
  ShoppingBag, Shirt, Footprints, Gift, Gamepad2, Clapperboard, Music, BookOpen, Palette, Dumbbell, Sparkles, Ticket, Tv, Laptop,
  Pill, Stethoscope, Baby, Dog, Cat, Scissors, HeartPulse, Heart, GraduationCap, School, Pencil, Users, HandHeart,
  Wallet, Banknote, CreditCard, Landmark, PiggyBank, Coins, TrendingUp, Receipt, Briefcase, PartyPopper, HandCoins,
  Repeat, ArrowLeftRight, RefreshCw, Undo2, Plus, Package, Building2, Globe, Star, Tag, CircleHelp, Vault, BadgeDollarSign,
  type LucideIcon,
} from 'lucide-react';

// Icons are stored by name (e.g. "shopping-cart") and drawn from this registry. Anything outside it
// is shown with a neutral fallback, so a stored value can never inject markup.
export const ICONS: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart, coffee: Coffee, utensils: Utensils, pizza: Pizza, sandwich: Sandwich, apple: Apple,
  beer: Beer, wine: Wine, 'cup-soda': CupSoda, cake: Cake, soup: Soup, 'ice-cream': IceCreamCone,
  house: House, lightbulb: Lightbulb, plug: Plug, wifi: Wifi, smartphone: Smartphone, droplets: Droplets, flame: Flame,
  sofa: Sofa, wrench: Wrench, hammer: Hammer, trash: Trash2, zap: Zap, phone: Phone,
  car: Car, fuel: Fuel, bus: Bus, train: TrainFront, plane: Plane, bike: Bike, hotel: Hotel, luggage: Luggage, map: Map,
  parking: SquareParking, ship: Ship,
  'shopping-bag': ShoppingBag, shirt: Shirt, footprints: Footprints, gift: Gift, gamepad: Gamepad2, film: Clapperboard,
  music: Music, book: BookOpen, palette: Palette, dumbbell: Dumbbell, sparkles: Sparkles, ticket: Ticket, tv: Tv, laptop: Laptop,
  pill: Pill, stethoscope: Stethoscope, baby: Baby, dog: Dog, cat: Cat, scissors: Scissors, 'heart-pulse': HeartPulse,
  heart: Heart, 'graduation-cap': GraduationCap, school: School, pencil: Pencil, users: Users, 'hand-heart': HandHeart,
  wallet: Wallet, banknote: Banknote, 'credit-card': CreditCard, landmark: Landmark, 'piggy-bank': PiggyBank, coins: Coins,
  'trending-up': TrendingUp, receipt: Receipt, briefcase: Briefcase, party: PartyPopper, 'hand-coins': HandCoins,
  repeat: Repeat, 'arrow-left-right': ArrowLeftRight, exchange: RefreshCw, undo: Undo2, plus: Plus, package: Package,
  building: Building2, globe: Globe, star: Star, tag: Tag, help: CircleHelp, vault: Vault, 'badge-dollar': BadgeDollarSign,
};

export const ICON_NAMES = Object.keys(ICONS);

/** Icons offered for categories, in groups. */
export const CATEGORY_ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Food & drink', icons: ['shopping-cart', 'utensils', 'coffee', 'pizza', 'sandwich', 'soup', 'apple', 'cake', 'ice-cream', 'cup-soda', 'beer', 'wine'] },
  { label: 'Home & bills', icons: ['house', 'lightbulb', 'zap', 'plug', 'wifi', 'smartphone', 'phone', 'droplets', 'flame', 'sofa', 'wrench', 'trash'] },
  { label: 'Transport & travel', icons: ['car', 'fuel', 'bus', 'train', 'plane', 'bike', 'ship', 'parking', 'hotel', 'luggage', 'map', 'globe'] },
  { label: 'Shopping & fun', icons: ['shopping-bag', 'shirt', 'footprints', 'gift', 'gamepad', 'film', 'music', 'ticket', 'tv', 'laptop', 'book', 'dumbbell'] },
  { label: 'Health & family', icons: ['pill', 'stethoscope', 'heart-pulse', 'baby', 'dog', 'cat', 'scissors', 'sparkles', 'heart', 'hand-heart', 'users', 'graduation-cap'] },
  { label: 'Money', icons: ['wallet', 'banknote', 'credit-card', 'landmark', 'piggy-bank', 'coins', 'trending-up', 'receipt', 'briefcase', 'hand-coins', 'repeat', 'exchange'] },
  { label: 'Other', icons: ['package', 'tag', 'star', 'party', 'undo', 'plus', 'school', 'pencil', 'building', 'palette', 'hammer', 'help'] },
];

/** Icons offered for accounts and account types. */
export const ACCOUNT_ICON_NAMES = [
  'landmark', 'building', 'credit-card', 'banknote', 'wallet', 'piggy-bank', 'coins', 'vault', 'badge-dollar', 'trending-up',
  'briefcase', 'graduation-cap', 'plane', 'globe', 'house', 'car', 'smartphone', 'shopping-cart', 'gift', 'hand-coins',
  'heart', 'star', 'receipt', 'tag',
];

// The emoji older data and backups used, mapped to the closest icon.
const EMOJI_TO_ICON: Record<string, string> = {
  '🛒': 'shopping-cart', '🍔': 'utensils', '🍕': 'pizza', '🍜': 'soup', '🍣': 'utensils', '🥗': 'utensils', '🍱': 'utensils',
  '☕': 'coffee', '🧋': 'cup-soda', '🍺': 'beer', '🥖': 'sandwich', '🍎': 'apple', '🍰': 'cake', '🍦': 'ice-cream', '🍷': 'wine',
  '🏠': 'house', '🏡': 'house', '💡': 'lightbulb', '🔌': 'plug', '🌐': 'wifi', '📱': 'smartphone', '📲': 'smartphone',
  '💧': 'droplets', '🔥': 'flame', '🛋': 'sofa', '🧹': 'trash', '🧺': 'shirt', '🔧': 'wrench', '⚡': 'zap', '📞': 'phone',
  '🚗': 'car', '⛽': 'fuel', '🚕': 'car', '🚌': 'bus', '🚆': 'train', '🚇': 'train', '✈': 'plane', '🏨': 'hotel', '🧳': 'luggage',
  '🛵': 'bike', '🚲': 'bike', '🗺': 'map', '🅿': 'parking', '🚢': 'ship', '🌏': 'globe', '🌍': 'globe', '🌎': 'globe',
  '🛍': 'shopping-bag', '👕': 'shirt', '👟': 'footprints', '🎁': 'gift', '🎮': 'gamepad', '🎬': 'film', '🎵': 'music',
  '📚': 'book', '🎨': 'palette', '⚽': 'dumbbell', '🏋': 'dumbbell', '💄': 'sparkles', '🎟': 'ticket', '📺': 'tv', '💻': 'laptop',
  '💊': 'pill', '🏥': 'stethoscope', '🦷': 'stethoscope', '👶': 'baby', '🐶': 'dog', '🐱': 'cat', '💇': 'scissors',
  '🧘': 'heart-pulse', '❤': 'heart', '💝': 'hand-heart', '🎓': 'graduation-cap', '🏫': 'school', '✏': 'pencil', '👨‍👩‍👧': 'users',
  '💰': 'coins', '💵': 'banknote', '💴': 'banknote', '💶': 'banknote', '💷': 'banknote', '💳': 'credit-card', '🏦': 'landmark',
  '🏛': 'building', '📈': 'trending-up', '💸': 'banknote', '🪙': 'coins', '🧾': 'receipt', '💼': 'briefcase', '🎉': 'party',
  '🤝': 'hand-coins', '🔁': 'repeat', '🔄': 'repeat', '💱': 'exchange', '🏧': 'banknote', '🐷': 'piggy-bank', '👛': 'wallet',
  '👜': 'shopping-bag', '⭐': 'star', '📦': 'package', '↩': 'undo', '➕': 'plus', '❓': 'help', '🏷': 'tag',
};

/**
 * The registry name for a stored icon value: an icon name stays as is, an emoji from older data is
 * translated, and anything else (or nothing) gives null so callers can use their fallback.
 */
export function toIconName(value: string | null | undefined): string | null {
  if (!value) return null;
  if (ICONS[value]) return value;
  const bare = value.replace(/[︎️]/g, ''); // drop emoji/text variation selectors
  return EMOJI_TO_ICON[bare] ?? EMOJI_TO_ICON[value] ?? null;
}
