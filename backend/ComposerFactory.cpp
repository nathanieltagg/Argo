#include "ComposerFactory.h"
#include "json.hpp"
#include "json_tools.h"
#include "TROOT.h"
#include <TSystem.h>
#include <TFile.h>
#include <iostream>

#include "GalleryComposer.h"
#include "UbdaqComposer.h"
#include "AnalysisTreeComposer.h"
#include "LarliteComposer.h"

using nlohmann::json;
size_t ComposerFactory::events_served = 0;


#include <gallery/Event.h>

Result_t ComposerFactory::compose(Request_t request)
{
  Result_t result(new json(json::object()));

  long eventTimeStart = gSystem->Now();

  if(!request) {
    (*result)["error"] = "Bad request"; return result;
  }
  std::string filename = "";
  try {
    filename = request->value("filename","");
  } catch(...) {};
  if(filename=="") {
    (*result)["error"] = "Bad request"; return result;
  }


  // Next: What kind of file is being requested?

  bool is_daqfile = false;
  bool is_artfile = false;
  bool is_anafile = false;
  bool is_larlite = false;

  const std::string daqSuffix(".ubdaq");
  if( filename.length() >= daqSuffix.length() ) {
    is_daqfile = (0 == filename.compare( filename.length() - daqSuffix.length(), daqSuffix.length(), daqSuffix));
  }
  if(!is_daqfile) {
    TFile rootfile(filename.c_str(),"READ");
    if(rootfile.IsOpen()) {
      std::cout << "Can open file. " << filename << std::endl;
      if(rootfile.Get("Events") )               is_artfile = true;
      if(rootfile.Get("analysistree/anatree") ) is_anafile = true;
      if(rootfile.Get("larlite_id_tree") )      is_larlite = true;
    } else {
      std::cout << "Can't open file! " << filename << std::endl;
      (*result)["error"] = "Cannot open file " + filename; return result;
    }
    // delete rootfile;
  }

  // Did the user specifically request an existing Composer thread? (This could be a re-request or a request for a new event in the same file.)
  // Check that composer is of correct type.
  // Check that composer can_satisfy the request
  // FIXME
  // Otherwise, create a composer.

  Composer* composer = nullptr;
  if     (is_daqfile) composer = new UbdaqComposer();
  else if(is_artfile) composer = new GalleryComposer();
  else if(is_anafile) composer = new AnalysisTreeComposer();
  else if(is_larlite) composer = new LarliteComposer();
  else {
    (*result)["error"] = "Unrecognized file type.";
    return result;
  }
  
  composer->configure(m_config);
  composer->initialize();
  composer->satisfy_request(request,result);
  delete composer;

  // // Add statistics.
//   json monitor;
//   monitor["pid"] = gSystem->GetPid();
//   monitor["events_served"] = events_served;
//   SysInfo_t sysinfo;  gSystem->GetSysInfo(&sysinfo);
//   // CpuInfo_t cpuinfo;  gSystem->GetCpuInfo(&cpuinfo);
//   MemInfo_t meminfo;  gSystem->GetMemInfo(&meminfo);
//   ProcInfo_t procinfo; gSystem->GetProcInfo(&procinfo);
//
//   monitor["OS"           ] =  sysinfo.fOS.Data();
//   monitor["ComputerModel"] =  sysinfo.fModel.Data();
//   monitor["CpuType"      ] =   sysinfo.fCpuType.Data();
//   monitor["Cpus"         ] =   sysinfo.fCpus;
//   monitor["CpuSpeed"     ] =   sysinfo.fCpuSpeed;
//   monitor["PhysicalRam"  ] =   sysinfo.fPhysRam;
//
//   monitor["MemTotal"     ] =   Form("%d MB",meminfo.fMemTotal);
//   monitor["MemUsed"      ] =   Form("%d MB",meminfo.fMemUsed);
//   monitor["MemFree"      ] =   Form("%d MB",meminfo.fMemFree);
//   monitor["SwapTotal"    ] =   Form("%d MB",meminfo.fSwapTotal);
//   monitor["SwapUsed"     ] =   Form("%d MB",meminfo.fSwapUsed);
//   monitor["SwapFree"     ] =   Form("%d MB",meminfo.fSwapFree);
//
//   monitor["CpuTimeUser"     ] =   procinfo.fCpuUser;
//   monitor["CpuTimeSys"     ] =    procinfo.fCpuSys;
//   monitor["MemResident"    ] =    Form("%f MB",procinfo.fMemResident/1000.);
//   monitor["MemVirtual"     ] =    Form("%f MB",procinfo.fMemVirtual/1000.);
//
//   monitor["WallClockTime"  ] =    ((long)gSystem->Now())/1000.;
//   result->emplace("backend_monitor",monitor);
//
//
//   long ElapsedServerTime = ((long)(gSystem->Now()) - eventTimeStart);
//   (*result)["ElapsedServerTime"] = ElapsedServerTime;
//   std::cout << "ElapsedServerTime: " << ElapsedServerTime << std::endl;
//

  // cleaup any unused composers.
  // FIXME
  long eventTimeEnd = gSystem->Now();
  std::cout << "Total factory time: " << eventTimeEnd - eventTimeStart << std::endl;
  return result;
}

