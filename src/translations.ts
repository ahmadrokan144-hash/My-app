export type Language = "ku" | "en";

export interface Translations {
  appName: string;
  appSubtitle: string;
  tabTakeTicket: string;
  tabCounter: string;
  tabQueueList: string;
  tabSettings: string;
  tabProfile: string;
  
  // Board & Tickets
  liveBoardTitle: string;
  nowServing: string;
  counterNum: string;
  waitingCount: string;
  avgWait: string;
  minutes: string;
  takeTicketTitle: string;
  takeTicketSubtitle: string;
  selectDepartment: string;
  customerNameOptional: string;
  customerPhoneOptional: string;
  generateTicketBtn: string;
  
  // My Ticket Slip
  myTicketTitle: string;
  ticketNumber: string;
  peopleAheadOfYou: string;
  estimatedWaitTime: string;
  statusWaiting: string;
  statusCalled: string;
  statusServing: string;
  statusCompleted: string;
  statusSkipped: string;
  goToCounterAlert: string;
  cancelTicket: string;
  hasNoTicket: string;
  
  // Counter Operations
  counterDeskTitle: string;
  counterDeskSubtitle: string;
  activeCounterSelect: string;
  callNextBtn: string;
  noOneWaiting: string;
  recallBtn: string;
  completeBtn: string;
  skipBtn: string;
  currentCustomerServing: string;
  servedHistoryToday: string;
  noServedYet: string;
  
  // Queue Monitor
  allTickets: string;
  waitingTab: string;
  servingTab: string;
  completedTab: string;
  skippedTab: string;
  searchPlaceholder: string;
  noTicketsFound: string;
  timeRequested: string;
  
  // Settings
  settingsTitle: string;
  settingsSubtitle: string;
  appearance: string;
  darkMode: string;
  lightMode: string;
  languageSelect: string;
  kurdish: string;
  english: string;
  audioChime: string;
  testSound: string;
  resetQueueToday: string;
  resetConfirm: string;
  demoDataBtn: string;
  aboutTitle: string;
  aboutText: string;
}

export const translations: Record<Language, Translations> = {
  ku: {
    appName: "کەناڵە جیهانییەکان",
    appSubtitle: "پەخشی ڕاستەوخۆی کەناڵە تەلەفزیۆنییەکانی جیهان",
    tabTakeTicket: "کەناڵەکان",
    tabCounter: "پۆلەکان",
    tabQueueList: "دڵخوازەکان",
    tabSettings: "زیاتر",
    tabProfile: "پڕۆفایل",
    
    liveBoardTitle: "پەخشی ڕاستەوخۆی کەناڵەکان",
    nowServing: "کەناڵی ئێستا",
    counterNum: "کەناڵی",
    waitingCount: "کەناڵە چالاکەکان",
    avgWait: "کوالێتی پەخش",
    minutes: "HD",
    takeTicketTitle: "سەیرکردنی کەناڵە جیهانییەکان",
    takeTicketSubtitle: "بەش و وڵات هەڵبژێرە بۆ سەیرکردنی پەخشی ڕاستەوخۆ",
    selectDepartment: "هەڵبژاردنی پۆلی کەناڵەکان",
    customerNameOptional: "ناوی کەناڵ",
    customerPhoneOptional: "کۆدی کەناڵ",
    generateTicketBtn: "کردنەوەی پەخشی ڕاستەوخۆ",
    
    myTicketTitle: "کەناڵی هەڵبژێردراو",
    ticketNumber: "ژمارەی کەناڵ",
    peopleAheadOfYou: "بینەر لەسەر هێڵن",
    estimatedWaitTime: "خێرایی پەخش",
    statusWaiting: "ئامادەکاری پەخش",
    statusCalled: "پەخشی ڕاستەوخۆ بەردەستە",
    statusServing: "لە کاتی پەخشدایە",
    statusCompleted: "تەواوبوو",
    statusSkipped: "وەستاوە",
    goToCounterAlert: "پەخشی ڕاستەوخۆ دەستی پێکرد لە",
    cancelTicket: "داخستنی کەناڵ",
    hasNoTicket: "هێشتا هیچ کەناڵێک زیاد نەکراوە.",
    
    counterDeskTitle: "بەڕێوەبردنی کەناڵەکان",
    counterDeskSubtitle: "ڕێکخستن و کۆنترۆڵکردنی پەخشی کەناڵە جیهانییەکان",
    activeCounterSelect: "دیاریکردنی سێرڤەری پەخش",
    callNextBtn: "کەناڵی داهاتوو",
    noOneWaiting: "هیچ کەناڵێک لە لیستدا نییە",
    recallBtn: "نوێکردنەوەی پەخش",
    completeBtn: "پاشەکەوتکردن",
    skipBtn: "پەڕاندن",
    currentCustomerServing: "کەناڵی ئێستا لە پەخشدا",
    servedHistoryToday: "دوایین کەناڵە بینراوەکان",
    noServedYet: "تا ئێستا هیچ کەناڵێک سەیر نەکراوە",
    
    allTickets: "هەموو کەناڵەکان",
    waitingTab: "ڕاستەوخۆ",
    servingTab: "وەرزشی",
    completedTab: "هەواڵ",
    skippedTab: "فیلم و زنجیرە",
    searchPlaceholder: "گەڕان بەپێی ناوی کەناڵ یان وڵات...",
    noTicketsFound: "هیچ کەناڵێک نەدۆزرایەوە",
    timeRequested: "کاتی پەخش",
    
    settingsTitle: "ڕێکخستنەکانی ئەپڵیکەیشن",
    settingsSubtitle: "دەستکاریکردنی ڕووکار، دەنگ و زمان",
    appearance: "ڕووکار و دیمەن",
    darkMode: "دۆخی تاریک (Dark Mode)",
    lightMode: "دۆخی ڕووناک (Light Mode)",
    languageSelect: "زمانی ئەپڵیکەیشن",
    kurdish: "کوردی (سۆرانی)",
    english: "English",
    audioChime: "کاریگەری دەنگی کاتی گۆڕینی کەناڵ",
    testSound: "تاقیکردنەوەی دەنگ",
    resetQueueToday: "سڕینەوەی مێژوو و کەناڵە پاشەکەوتکراوەکان",
    resetConfirm: "دڵنیایت لە سڕینەوەی مێژوو و داتای کەناڵەکان؟",
    demoDataBtn: "نوێکردنەوەی داتای پەخش",
    aboutTitle: "دەربارەی ئەپەکە",
    aboutText: "ئەپڵیکەیشنی کەناڵە جیهانییەکان سیستەمێکی خێرا و مۆدێرنە بۆ سەیرکردنی پەخشی ڕاستەوخۆی کەناڵە تەلەفزیۆنییەکانی جیهان بە کوالێتی بەرز."
  },
  en: {
    appName: "Global TV",
    appSubtitle: "Live World TV Channels Streaming",
    tabTakeTicket: "Channels",
    tabCounter: "Categories",
    tabQueueList: "Favorites",
    tabSettings: "More",
    tabProfile: "Profile",
    
    liveBoardTitle: "Live Channels Broadcast",
    nowServing: "Now Playing",
    counterNum: "Channel",
    waitingCount: "Active Channels",
    avgWait: "Stream Quality",
    minutes: "HD",
    takeTicketTitle: "Watch Global Channels",
    takeTicketSubtitle: "Select category and country to watch live streams",
    selectDepartment: "Select Channel Category",
    customerNameOptional: "Channel Name",
    customerPhoneOptional: "Channel Code",
    generateTicketBtn: "Watch Live Stream",
    
    myTicketTitle: "Selected Channel",
    ticketNumber: "Channel Number",
    peopleAheadOfYou: "viewers online",
    estimatedWaitTime: "Stream Speed",
    statusWaiting: "Buffering stream",
    statusCalled: "LIVE! Stream is ready",
    statusServing: "Currently streaming",
    statusCompleted: "Ended",
    statusSkipped: "Offline",
    goToCounterAlert: "Live broadcast started on",
    cancelTicket: "Close Channel",
    hasNoTicket: "No channels have been added yet.",
    
    counterDeskTitle: "Channel Management",
    counterDeskSubtitle: "Control and manage global TV channel streams",
    activeCounterSelect: "Active Stream Server",
    callNextBtn: "Next Channel",
    noOneWaiting: "No channels in list",
    recallBtn: "Reload Stream",
    completeBtn: "Save Channel",
    skipBtn: "Skip Channel",
    currentCustomerServing: "Currently Streaming",
    servedHistoryToday: "Recently Watched Channels",
    noServedYet: "No channels watched yet",
    
    allTickets: "All Channels",
    waitingTab: "Live",
    servingTab: "Sports",
    completedTab: "News",
    skippedTab: "Movies",
    searchPlaceholder: "Search channel name or country...",
    noTicketsFound: "No channels found",
    timeRequested: "Stream Time",
    
    settingsTitle: "App Settings",
    settingsSubtitle: "Configure appearance, sound and language",
    appearance: "Appearance",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    languageSelect: "Language",
    kurdish: "Kurdish (کوردی)",
    english: "English",
    audioChime: "Sound effect on channel switch",
    testSound: "Test Sound",
    resetQueueToday: "Clear History & Saved Channels",
    resetConfirm: "Are you sure you want to clear your channel history and data?",
    demoDataBtn: "Refresh Stream Data",
    aboutTitle: "About Global TV",
    aboutText: "Global TV is a fast, modern application designed for watching live television channels from around the world in high quality."
  }
};

