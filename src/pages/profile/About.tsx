import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";

const About = () => {
  const navigate = useNavigate();

  const handleItemClick = (item: string) => {
    // TODO: Implement navigation or actions for each item
    console.log(`Clicked: ${item}`);
  };

  return (
    <div className="min-h-screen bg-gradient-warm p-6 pb-8">
      {/* Header */}
      <div
        className="flex items-center justify-between mb-8"
        style={{
          paddingTop: "calc(0.5rem + var(--safe-area-top))",
        }}
      >
        <button
          onClick={() => navigate("/profile")}
          className="p-2 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">About & Support</h1>
        <div className="w-10"></div>
      </div>

      {/* App Information */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">
          App Information
        </h2>
        <div className="glass-card divide-y divide-border">
          <button
            onClick={() => handleItemClick("version")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground">
                Version
              </div>
            </div>
            <div className="text-sm text-muted-foreground mr-2">1.0.0</div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>

          <button
            onClick={() => handleItemClick("whats-new")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                What's New
              </div>
              <div className="text-sm text-muted-foreground">
                Latest updates and features
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>
        </div>
      </div>

      {/* Support */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Support</h2>
        <div className="glass-card divide-y divide-border">
          <button
            onClick={() => handleItemClick("help-center")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Help Center
              </div>
              <div className="text-sm text-muted-foreground">
                FAQs and guides
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>

          <button
            onClick={() => handleItemClick("contact-support")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Contact Support
              </div>
              <div className="text-sm text-muted-foreground">
                Get help with issues
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>

          <button
            onClick={() => handleItemClick("send-feedback")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Send Feedback
              </div>
              <div className="text-sm text-muted-foreground">
                Share your thoughts
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>
        </div>
      </div>

      {/* Legal */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Legal</h2>
        <div className="glass-card divide-y divide-border">
          <button
            onClick={() => handleItemClick("privacy-policy")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground">
                Privacy Policy
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>

          <button
            onClick={() => handleItemClick("terms-of-service")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground">
                Terms of Service
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>

          <button
            onClick={() => handleItemClick("licenses")}
            className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground mb-1">
                Licenses
              </div>
              <div className="text-sm text-muted-foreground">
                Open source libraries
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
          </button>
        </div>
      </div>

      {/* App Description */}
      <div className="glass-card p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center">
          <span className="text-3xl">💪</span>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">
          AI HIIT Coach
        </h3>
        <p className="text-sm text-muted-foreground">
          Your personal AI-powered high-intensity interval training coach.
          Get personalized workouts that adapt to your fitness level and goals.
        </p>
      </div>
    </div>
  );
};

export default About;
