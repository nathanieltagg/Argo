#include "Logging.h"
#include <boost/thread.hpp>
#include <iostream>
#include <sys/time.h>
#include <time.h>

// Make my own logging the default, since it's clear that the DAQ isn't switching to MF any time soon.
#define NO_MSGLOG 1

#ifndef NO_MSGLOG
#include "share/StringUtils.h"
#include "sebs/commandLineOptions.h"
#include "share/configurationFHICLReader.h"
#include <messagefacility/MessageLogger/MessageLogger.h>
#include "share/applicationBase.h"
#endif

using namespace logging;

Logger* Logger::sLogger;

Logger::Logger()
{
 level = info; 
 dotime = true;
}

Logger::~Logger()
{
  
}

void Logger::setupMessageFacility( const std::string& app_name )
{
#ifndef NO_MSGLOG
 using namespace gov::fnal::uboone;
  share::startMessageFacility();
  mf::SetApplicationName(app_name);
  mf::SetModuleName("");
  mf::SetContext("");
  

  // // Call before anything else, to ensure that logging is set up correctly.
  // // Start MessageFacility Service
  // appname = app_name;
  // try {
  //   std::string logFileName = app_name; //{share::applicationName(app_name)};
  //   logFileName.append(gov::fnal::uboone::utils::getTimestampAsString()).append(".log");
  //
  //   mf::StartMessageFacility ( mf::MessageFacilityService::MultiThread
  //     ,  mf::MessageFacilityService::logCS());
  //   //, mf::MessageFacilityService::logFS(logFileName));
  //   // Set application name (use process name by default)
  //   mf::SetApplicationName ( app_name );
  //   // Set module name and context for the main thread
  //   mf::SetModuleName ( module_name );
  //   mf::SetContext ( context );
  // } catch ( std::exception const& ex ) {
  //   mf::LogError ( appname ) << "Caught exception in Logger::setupMessageFacility(). Message:" << ex.what();
  // } catch ( ... ) {
  //   mf::LogError ( appname ) << "Caught exception in Logger::setupMessageFacility().";
  // }
  
#else 
  (void) app_name;
#endif
}

void Logger::setLevel(const std::string& lvl)
{
       if(lvl == "verbose") setLevel(verbose);
  else if(lvl == "debug")   setLevel(debug   );
  else if(lvl == "info")    setLevel(info    );
  else if(lvl == "warn")    setLevel(warn);
  else if(lvl == "error")   setLevel(error   );
  else if(lvl == "fatal")   setLevel(fatal   );
  else if(lvl == "debug")   setLevel(debug   );  
}


boost::mutex logger_mutex;

void Logger::print(const Submission& sub)
{
#ifdef NO_MSGLOG  
  if( should_print(sub.mLevel)) {
    boost::mutex::scoped_lock lock(logger_mutex);

    // Header.
    if     (sub.mLevel <= verbose ) std::cout << "verbose " ;
    else if(sub.mLevel <= debug   ) std::cout << "debug   " ;
    else if(sub.mLevel <= info    ) std::cout << "info    " ;
    else if(sub.mLevel <= warn    ) std::cout << "warn    " ;
    else if(sub.mLevel <= error   ) std::cout << "Error   " ;
    else if(sub.mLevel <= fatal   ) std::cout << "FATAL   " ;
    
    std::cout << sub.mFile << ":" << sub.mLine << " ";
    if(doTime()) {
      time_t rawtime;
      tm timeinfo;
      char buff[80];
      time(&rawtime);
      localtime_r(&rawtime,&timeinfo);
      strftime(buff,80,"%H:%M:%S",&timeinfo);
      std::cout << " " << buff << " ";
    }
    std::cout << sub.mStream.str() << std::endl;
  }
#else
  // use the messagelogging facilty
  if( should_print(sub.mLevel)) {
    // boost::mutex::scoped_lock lock(logger_mutex);
    //
    // std::string timestr = "";
    // if(doTime()) {
    //   time_t rawtime;
    //   tm timeinfo;
    //   time(&rawtime);
    //   localtime_r(&rawtime,&timeinfo);
    //   char buff[80];
    //   strftime(buff,80,"%H:%M:%S",&timeinfo);
    //   timestr = " ";
    //   timestr += buff;
    //   timestr += " ";
    // }
    
    // Header.
    // if     (sub.mLevel <= verbose )  mf::LogVerbatim ( appname ) <<  sub.mFile << ":" << sub.mLine << " " << timestr << sub.mStream.str();
    // else if(sub.mLevel <= debug   )  mf::LogDebug    ( appname ) <<  sub.mFile << ":" << sub.mLine << " " << timestr << sub.mStream.str();
    // else if(sub.mLevel <= info    )  mf::LogInfo     ( appname ) <<  sub.mFile << ":" << sub.mLine << " " << timestr << sub.mStream.str();
    // else if(sub.mLevel <= warn    )  mf::LogWarning  ( appname ) <<  sub.mFile << ":" << sub.mLine << " " << timestr << sub.mStream.str();
    // else if(sub.mLevel <= error   )  mf::LogError    ( appname ) <<  sub.mFile << ":" << sub.mLine << " " << timestr << sub.mStream.str();
    // else if(sub.mLevel <= fatal   )  mf::LogAbsolute ( appname ) <<  sub.mFile << ":" << sub.mLine << " " << timestr << sub.mStream.str();

    if     (sub.mLevel <= verbose )  mf::LogVerbatim ( appname ) << sub.mStream.str();
    else if(sub.mLevel <= debug   )  mf::LogDebug    ( appname ) << sub.mStream.str();
    else if(sub.mLevel <= info    )  mf::LogInfo     ( appname ) << sub.mStream.str();
    else if(sub.mLevel <= warn    )  mf::LogWarning  ( appname ) << sub.mStream.str();
    else if(sub.mLevel <= error   )  mf::LogError    ( appname ) << sub.mStream.str();
    else if(sub.mLevel <= fatal   )  mf::LogAbsolute ( appname ) << sub.mStream.str();
  }
#endif
}



Submission::~Submission()
{
  Logger::instance().print(*this);
  /*if( l.should_print(mLevel)) {
    // Thread safety!
    boost::mutex::scoped_lock lock(logger_mutex);

    // Header.
    if     (mLevel <= verbose ) std::cout << "verbose " ;
    else if(mLevel <= debug   ) std::cout << "debug   " ;
    else if(mLevel <= info    ) std::cout << "info    " ;
    else if(mLevel <= warn    ) std::cout << "warn    " ;
    else if(mLevel <= error   ) std::cout << "Error   " ;
    else if(mLevel <= fatal   ) std::cout << "FATAL   " ;
    
    std::cout << mFile << ":" << mLine << " ";
    if(l.doTime()) {
      time_t rawtime;
      tm timeinfo;
      char buff[80];
      time(&rawtime);
      localtime_r(&rawtime,&timeinfo);
      strftime(buff,80,"%H:%M:%S",&timeinfo);
      std::cout << " " << buff << " ";
    }
    std::cout << mStream.str() << std::endl;
  }
  */
}
