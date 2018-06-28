#ifndef LOGGING_H
#define LOGGING_H

#include <ostream>
#include <sstream>

// Fairly simple logging.
// Could be replaced with log4cpp or boost.log or whatever.

// Extremely efficient: unused strings aren't even computed!
#define LOG(lvl) \
  if( !logging::Logger::instance().should_print(lvl)) {;} \
  else  logging::Logger::instance().submit(lvl,__LINE__,__FILE__).stream()
    
// Less efficient, but more predictable.
/*
#define LOG(lvl)							\
  logging::Logger::instance().submit(lvl,__LINE__,__FILE__).stream()
*/

#define logVerbose LOG(logging::verbose)
#define logDebug   LOG(logging::debug)
#define logInfo    LOG(logging::info)
#define logWarn    LOG(logging::warn)
#define logError   LOG(logging::error)
#define logFatal   LOG(logging::fatal)

// The actual logging routines.
namespace logging {
  
  enum Level_t {
    verbose   = 10,
    debug   = 20 ,
    info    = 30 ,
    warn    = 40,
    error   = 50,
    fatal   = 60
  };
  
  
  class Submission {
    public:
    Submission( Level_t lvl, int line=-1, const char* file="" ) 
       : mLevel(lvl), mLine(line), mFile(file) {};
    Submission(const Submission& o) 
      :  mLevel(o.mLevel), mLine(o.mLine), mFile(o.mFile) {};

    ~Submission();
    std::ostringstream& stream() { return mStream; }

    // prints when the object is destroyed.
    Level_t     mLevel;
    int         mLine;
    std::string mFile;
    std::ostringstream mStream;
  };
    
  class Logger {
    private:
      static Logger* sLogger;
    public:
      static Logger& instance() { if(sLogger==0) sLogger = new Logger; return *sLogger; }
      
      void setupMessageFacility( const std::string& app_name );
      void setLevel(int lvl) {level=(Level_t)lvl;}
      void setLevel(Level_t lvl) {level=lvl;}
      void setLevel(const std::string& lvl);
    
      void setTime(bool on=true) { dotime = on; }
      bool doTime() const { return dotime; }
    
      Logger();
      ~Logger();

      Level_t level;
      bool    dotime;
      std::string appname;
      
      Submission submit(Level_t lvl, int line=-1, const char* file="") { return Submission(lvl,line,file); }
      void print(const Submission&);
      bool     should_print(Level_t msgLvl) { return (msgLvl >= level); }
  };
  
} // end namespace




#endif /* end of include guard: LOGGING_H */

