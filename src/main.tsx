import { createClient } from '@supabase/supabase-js';

// Expose la lib et l'env AU GLOBAL (ce que lit ton App)
(window as any).supabase = { createClient };
(window as any).__ENV__ = {
  SUPABASE_URL: 'https://nwedkwmandxwejefjrhu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWRrd21hbmR4d2VqZWZqcmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODc0MjcsImV4cCI6MjA3NzI2MzQyN30.jBCCFRK7ke6GjVQX7xaxyqxbCw7BrEvKZqHZ0dT8kGY'
};

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
