#ifndef GETSLOMONDB_H_DBECAD54
#define GETSLOMONDB_H_DBECAD54

#include <string>
#include <ctime>
#include <iomanip>
#include <sstream>

// Functor for doing DB retrieval.
class GetSlowMonDB
{
public:
  GetSlowMonDB(const std::string& inTime="now", const std::string& inChannel="uB_TPCDrift_HV01_1_0/voltage")
      : val("{\"error\":\"Can't connect to DB\"}")
      , time(inTime)
      , channel(inChannel)
        {};
    GetSlowMonDB(double inTime, const std::string& inChannel="uB_TPCDrift_HV01_1_0/voltage")
          : val("{\"error\":\"Can't connect to DB\"}")
          , channel(inChannel)
            {
              std::time_t t = inTime;
              std::ostringstream os;
              os << std::put_time(std::gmtime(&t),"%F %T"); 
              time = os.str();
            };

  void operator()();
  
  std::string val;
  std::string time;
  std::string channel;
  
    
  
};


#endif /* end of include guard: GETSLOMONDB_H_DBECAD54 */
