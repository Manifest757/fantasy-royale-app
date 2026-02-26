export interface Contest {
  id: string;
  title: string;
  sponsor: string;
  sponsorLogo: string;
  league: string;
  prizePool: string;
  entries: number;
  maxEntries: number;
  startsAt?: string;
  endsAt: string;
  crowns: number;
  isPremier: boolean;
  backgroundImage?: string;
  status?: string;
  scoring_json?: any;
  contest_type?: string;
}

export interface UserContest {
  id: string;
  contestId: string;
  contestTitle: string;
  sponsor: string;
  status: 'pending' | 'live' | 'completed';
  picks: string[];
  crownsEarned: number;
  position?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  badge?: 'BEST SELLER' | 'NEW' | 'LIMITED' | 'PREMIUM';
  category: 'T-Shirts' | 'Hats' | 'Apparel';
  sizes?: string[];
  description: string;
}

export interface NewsItem {
  id: string;
  source: string;
  headline: string;
  timestamp: string;
  thumbnail?: string;
}

export interface VideoItem {
  id: string;
  username: string;
  caption: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  category: 'Predictions' | 'Celebrations' | 'Live';
  thumbnail: string;
}

export interface User {
  id: string;
  username: string;
  avatar: string;
  crowns: number;
  memberSince: string;
  contestsEntered: number;
  wins: number;
  currentStreak: number;
  bestStreak?: number;
  badgeCount?: number;
  role?: string;
  is_admin?: boolean;
}

export const mockUser: User = {
  id: '1',
  username: 'FantasyKing23',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
  crowns: 2450,
  memberSince: 'January 2024',
  contestsEntered: 47,
  wins: 12,
  currentStreak: 3,
};

export const mockContests: Contest[] = [
  {
    id: '1',
    title: 'Super Bowl Showdown',
    sponsor: 'Fantasy Royale',
    sponsorLogo: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100',
    league: 'NFL',
    prizePool: '$50,000',
    entries: 8432,
    maxEntries: 10000,
    endsAt: '2025-02-09T23:30:00',
    crowns: 500,
    isPremier: true,
  },
  {
    id: '2',
    title: 'March Madness Bracket Challenge',
    sponsor: 'Fantasy Royale',
    sponsorLogo: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=100',
    league: 'NCAAB',
    prizePool: '$25,000',
    entries: 5621,
    maxEntries: 8000,
    endsAt: '2025-03-15T18:00:00',
    crowns: 350,
    isPremier: false,
  },
  {
    id: '3',
    title: 'NBA All-Star Picks',
    sponsor: 'Fantasy Royale',
    sponsorLogo: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=100',
    league: 'NBA',
    prizePool: '$15,000',
    entries: 3200,
    maxEntries: 5000,
    endsAt: '2025-02-16T20:00:00',
    crowns: 250,
    isPremier: false,
  },
  {
    id: '4',
    title: 'Premier League Weekend',
    sponsor: 'Fantasy Royale',
    sponsorLogo: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=100',
    league: 'EPL',
    prizePool: '$10,000',
    entries: 2100,
    maxEntries: 3000,
    endsAt: '2025-02-08T15:00:00',
    crowns: 200,
    isPremier: false,
  },
];

export const mockUserContests: UserContest[] = [
  {
    id: '1',
    contestId: '1',
    contestTitle: 'Super Bowl Showdown',
    sponsor: 'Fantasy Royale',
    status: 'live',
    picks: ['Chiefs', 'Over 47.5', 'Patrick Mahomes MVP'],
    crownsEarned: 0,
    position: 234,
  },
  {
    id: '2',
    contestId: '3',
    contestTitle: 'NBA All-Star Picks',
    sponsor: 'Fantasy Royale',
    status: 'pending',
    picks: ['Team LeBron', 'Steph Curry 3PT King'],
    crownsEarned: 0,
  },
  {
    id: '3',
    contestId: '5',
    contestTitle: 'NFL Wild Card Weekend',
    sponsor: 'Fantasy Royale',
    status: 'completed',
    picks: ['Bills', 'Lions', 'Ravens', 'Buccaneers'],
    crownsEarned: 150,
    position: 89,
  },
];

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Fantasy Royale Champion Tee',
    price: 34.99,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
    rating: 4.8,
    reviews: 234,
    badge: 'BEST SELLER',
    category: 'T-Shirts',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    description: 'Premium cotton tee with embroidered crown logo. Show off your fantasy sports dominance.',
  },
  {
    id: '2',
    name: 'Crown Logo Snapback',
    price: 29.99,
    originalPrice: 39.99,
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400',
    rating: 4.6,
    reviews: 156,
    badge: 'LIMITED',
    category: 'Hats',
    description: 'Adjustable snapback with embroidered crown logo. One size fits most.',
  },
  {
    id: '3',
    name: 'Royale Hoodie',
    price: 59.99,
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400',
    rating: 4.9,
    reviews: 89,
    badge: 'PREMIUM',
    category: 'Apparel',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    description: 'Ultra-soft fleece hoodie with gradient crown print. Perfect for game day.',
  },
  {
    id: '4',
    name: 'Victory Lap Tee',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400',
    rating: 4.5,
    reviews: 67,
    badge: 'NEW',
    category: 'T-Shirts',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'Celebrate your wins with this premium graphic tee.',
  },
  {
    id: '5',
    name: 'Classic Dad Hat',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?w=400',
    rating: 4.7,
    reviews: 112,
    category: 'Hats',
    description: 'Relaxed fit dad hat with subtle crown embroidery.',
  },
];

export const mockNews: NewsItem[] = [
  {
    id: '1',
    source: 'Fantasy Royale',
    headline: 'Chiefs favored to win back-to-back Super Bowls as betting lines open',
    timestamp: '2 hours ago',
  },
  {
    id: '2',
    source: 'Fantasy Royale',
    headline: 'March Madness bracket predictions: Expert picks for the tournament',
    timestamp: '4 hours ago',
  },
  {
    id: '3',
    source: 'Fantasy Royale',
    headline: 'NBA Trade Deadline: Latest rumors and potential deals',
    timestamp: '5 hours ago',
  },
  {
    id: '4',
    source: 'Fantasy Royale',
    headline: 'Fantasy Football: Early rankings for next season released',
    timestamp: '6 hours ago',
  },
  {
    id: '5',
    source: 'Fantasy Royale',
    headline: 'Premier League title race heats up as top teams clash',
    timestamp: '8 hours ago',
  },
];

export const mockVideos: VideoItem[] = [
  {
    id: '1',
    username: 'AustinEkeler',
    caption: 'My Super Bowl prediction is LOCKED IN',
    timestamp: '1h ago',
    likes: 12400,
    comments: 892,
    shares: 234,
    category: 'Predictions',
    thumbnail: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400',
  },
  {
    id: '2',
    username: 'FantasyPro_Mike',
    caption: 'Called it! 5-0 on my picks this week',
    timestamp: '3h ago',
    likes: 8932,
    comments: 456,
    shares: 189,
    category: 'Celebrations',
    thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
  },
  {
    id: '3',
    username: 'BracketMaster',
    caption: 'LIVE: Breaking down the tournament matchups',
    timestamp: 'LIVE',
    likes: 3421,
    comments: 1205,
    shares: 87,
    category: 'Live',
    thumbnail: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400',
  },
  {
    id: '4',
    username: 'GridironGuru',
    caption: 'Why the Eagles are my dark horse pick',
    timestamp: '5h ago',
    likes: 6789,
    comments: 567,
    shares: 145,
    category: 'Predictions',
    thumbnail: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400',
  },
];

export const promoSlides = [
  {
    id: '1',
    type: 'gradient' as const,
    title: 'Super Bowl LVIII',
    subtitle: 'Enter FREE - Win $50K',
    sponsor: 'Fantasy Royale',
  },
  {
    id: '2',
    type: 'gradient' as const,
    title: 'March Madness',
    subtitle: 'Bracket Challenge Opens Soon',
    sponsor: 'Fantasy Royale',
  },
  {
    id: '3',
    type: 'gradient' as const,
    title: 'NBA All-Star Weekend',
    subtitle: 'Pick Your Winners',
    sponsor: 'Fantasy Royale',
  },
  {
    id: '4',
    type: 'gradient' as const,
    title: 'Premier League',
    subtitle: 'Weekly Picks Contest',
    sponsor: 'Fantasy Royale',
  },
];

export const tickerItems = [
  'KC Chiefs 24 - SF 49ers 21 (Q4)',
  'Lakers 108 - Celtics 105 (Final)',
  'Yankees 5 - Dodgers 3 (8th)',
  'Rangers 3 - Bruins 2 (OT)',
  'Warriors 95 - Heat 88 (Q3)',
];
