import { useNavigate, useLocation } from "react-router-dom";
import { Activity, Bookmark, User } from "lucide-react";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine which tab is active based on current route
  const isHomeActive = location.pathname === "/home";
  const isSavedActive = location.pathname === "/saved-workouts";
  const isProfileActive = location.pathname.startsWith("/profile");

  return (
    <div
      className="fixed bottom-0 left-0 right-0 glass-nav mx-auto max-w-md rounded-full mb-4"
      style={{
        marginBottom: 'calc(1rem + var(--safe-area-bottom))',
        marginLeft: 'auto',
        marginRight: 'auto',
        left: '1rem',
        right: '1rem',
        width: 'calc(100% - 2rem)',
        maxWidth: '400px'
      }}
    >
      <div className="flex items-center justify-around h-16 px-6">
        {/* Home Button */}
        <button
          onClick={() => navigate('/home')}
          className={`flex items-center justify-center w-12 h-12 rounded-full ${
            isHomeActive
              ? 'bg-gradient-primary shadow-[0_0_32px_rgba(254,173,99,0.5)]'
              : 'active:scale-95 transition-transform'
          }`}
        >
          <Activity
            className={`w-5 h-5 ${isHomeActive ? 'text-white' : 'text-white/70'}`}
          />
        </button>

        {/* Saved Workouts Button */}
        <button
          onClick={() => navigate('/saved-workouts')}
          className={`flex items-center justify-center ${
            isSavedActive
              ? 'w-12 h-12 rounded-full bg-gradient-primary shadow-[0_0_32px_rgba(254,173,99,0.5)]'
              : 'p-3 active:scale-95 transition-transform'
          }`}
        >
          <Bookmark
            className={`w-5 h-5 ${isSavedActive ? 'text-white' : 'text-white/70'}`}
          />
        </button>

        {/* Profile Button */}
        <button
          onClick={() => navigate('/profile')}
          className={`flex items-center justify-center ${
            isProfileActive
              ? 'w-12 h-12 rounded-full bg-gradient-primary shadow-[0_0_32px_rgba(254,173,99,0.5)]'
              : 'p-3 active:scale-95 transition-transform'
          }`}
        >
          <User
            className={`w-5 h-5 ${isProfileActive ? 'text-white' : 'text-white/70'}`}
          />
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
