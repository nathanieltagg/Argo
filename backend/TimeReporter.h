#ifndef TIMEREPORTER_H_79AD56D4
#define TIMEREPORTER_H_79AD56D4


#include "JsonElement.h"
#include "Timer.h"

class TimeReporter
{
public:
  std::string fName;
  Timer t;
  TimeReporter(const std::string& name="") :fName(name), t() {};
  ~TimeReporter() { std::cout << "++TimeReporter " << fName << " " << t.Count() << " s" << std::endl;}
  
  void addto(JsonObject& stats) { stats.add(fName,t.Count()); }
};


#endif /* end of include guard: TIMEREPORTER_H_79AD56D4 */
