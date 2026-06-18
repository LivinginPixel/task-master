"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckSquare, Zap, Shield, TrendingUp, ArrowRight, Sparkles } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Organize and manage your tasks with speed and efficiency",
    color: "from-yellow-400 via-orange-500 to-pink-500"
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is encrypted and protected with industry-standard security",
    color: "from-blue-400 via-purple-500 to-indigo-600"
  },
  {
    icon: TrendingUp,
    title: "Boost Productivity",
    description: "Stay focused and get more done with intelligent task management",
    color: "from-green-400 via-emerald-500 to-teal-600"
  }
];

export default function HomePageClient() {
  const [mounted, setMounted] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ 
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight
      });
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    
    // Ensure page can scroll
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="relative overflow-x-hidden w-full min-h-screen">
      {/* Animated Colorful Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-pink-500 to-orange-500 dark:from-violet-900 dark:via-pink-900 dark:to-orange-900 opacity-20 dark:opacity-10" />
        
        {/* Animated gradient orbs */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-30 dark:opacity-20 blur-3xl animate-pulse"
          style={{
            top: `${mousePosition.y * 80 - 250}%`,
            left: `${mousePosition.x * 80 - 250}%`,
            transition: 'all 0.3s ease-out',
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-r from-pink-400 to-red-500 opacity-30 dark:opacity-20 blur-3xl animate-pulse"
          style={{
            top: `${(1 - mousePosition.y) * 80 - 200}%`,
            right: `${(1 - mousePosition.x) * 80 - 200}%`,
            transition: 'all 0.3s ease-out',
            animationDelay: '1s',
          }}
        />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 opacity-25 dark:opacity-15 blur-3xl animate-pulse"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animationDelay: '2s',
          }}
        />
      </div>

      {/* Animated Pattern Overlay */}
      <div className="fixed inset-0 -z-10 opacity-10 dark:opacity-5 pointer-events-none">
        <div
          className="absolute inset-0 animate-pattern-move"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative pt-20 pb-8 sm:pt-32 sm:pb-16 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Animated Logo/Brand */}
            <div 
              className={`flex justify-center mb-8 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-60 dark:opacity-40 animate-pulse" />
                <div className="relative bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 dark:from-blue-500/30 dark:via-purple-500/30 dark:to-pink-500/30 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/30 dark:border-white/20 group-hover:scale-110 transition-transform duration-300">
                  <CheckSquare className="w-16 h-16 text-white mx-auto drop-shadow-lg animate-bounce-slow" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Animated Main Heading */}
            <h1 
              className={`text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ animationDelay: '0.2s' }}
            >
              Task Master
            </h1>
            
            <p 
              className={`text-xl sm:text-2xl text-foreground/90 mb-4 font-medium transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ animationDelay: '0.4s' }}
            >
              Your productivity companion
            </p>
            
            <p 
              className={`text-lg text-foreground/70 mb-12 max-w-2xl mx-auto leading-relaxed transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ animationDelay: '0.6s' }}
            >
              Organize your tasks, boost your productivity, and achieve your goals with a beautiful and intuitive task management experience.
            </p>

            {/* Animated CTA Buttons */}
            <div 
              className={`flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 sm:mb-16 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ animationDelay: '0.8s' }}
            >
              <Button 
                size="lg" 
                asChild 
                className="text-lg px-8 py-6 h-auto group relative overflow-hidden bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 border-0 text-white shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/70 transition-all duration-300 hover:scale-105"
              >
                <Link href="/auth/signup">
                  <span className="relative z-10 flex items-center">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild 
                className="text-lg px-8 py-6 h-auto border-2 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500 hover:scale-105 transition-all duration-300"
              >
                <Link href="/auth/signin">
                  Sign In
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Animated Features Section */}
      <section className="relative pt-8 pb-12 sm:pt-16 sm:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-16">
            <div 
              className={`inline-flex items-center gap-2 mb-4 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            >
              <Sparkles className="w-6 h-6 text-purple-500 animate-spin-slow" />
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Powerful Features
              </h2>
            </div>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
              Everything you need to stay organized and productive
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className={`group relative p-8 rounded-2xl border-2 bg-gradient-to-br ${feature.color} bg-opacity-10 dark:bg-opacity-5 backdrop-blur-sm hover:bg-opacity-20 dark:hover:bg-opacity-10 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  style={{ animationDelay: `${1 + index * 0.2}s` }}
                >
                  {/* Animated border gradient */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-sm`} />
                  
                  <div className="relative z-10">
                    <div className="mb-4">
                      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} text-white mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-lg`}>
                        <Icon className="w-7 h-7" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-foreground/70 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Animated Final CTA Section */}
      <section className="relative py-12 pb-16 sm:py-32 sm:pb-40 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-4xl mx-auto text-center">
          <div 
            className={`relative p-12 rounded-3xl border-2 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-pink-500/20 backdrop-blur-sm hover:scale-105 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ animationDelay: '1.6s' }}
          >
            {/* Animated border */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 blur-sm animate-pulse" />
            
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Ready to get started?
              </h2>
              <p className="text-lg text-foreground/70 mb-8 max-w-2xl mx-auto">
                Join Task Master today and take control of your productivity
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  asChild 
                  className="text-lg px-8 py-6 h-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 border-0 text-white shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/70 transition-all duration-300 hover:scale-105"
                >
                  <Link href="/auth/signup">
                    Create Free Account
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  asChild 
                  className="text-lg px-8 py-6 h-auto border-2 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500 hover:scale-105 transition-all duration-300"
                >
                  <Link href="/auth/signin">
                    Sign In
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
