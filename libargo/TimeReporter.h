#ifndef TIMEREPORTER_H_79AD56D4
#define TIMEREPORTER_H_79AD56D4


#include "json.hpp"
#include "Timer.h"
#include <iostream>

class TimeReporter
{
public:
  std::string fName;
  Timer t;
  TimeReporter(const std::string& name="") :fName(name), t() {};
  ~TimeReporter() { std::cout << "++TimeReporter " << fName << " " << t.Count() << " s" << std::endl;}
  
  void addto(nlohmann::json& stats) { stats[fName]=t.Count(); }
};


#endif /* end of include guard: TIMEREPORTER_H_79AD56D4 */
