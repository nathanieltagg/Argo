#include "Composer.h"
#include "json.hpp"

#include <TFile.h>
#include <TTree.h>
#include <TTreeFormula.h>
#include <TSystem.h>
#include <TROOT.h>

Composer::Composer() : m_result(nlohmann::json::object())
           , m_progress_target(1)
           , m_progress_so_far(0)
{   
  // ROOT::EnableThreadSafety ();  // This actually makes it FAIL big time!
  
};


Composer::~Composer()
{
}; // Destructor


bool Composer::can_satisfy(Request_t request ) 
{
  std::string filename = "";
  try {
    filename = request->value("filename","");
  } catch(...) {};
  if(filename=="") {
    return false;
  }
  if(m_filename.length()>0 && filename!=m_filename)
    return false;
  
  return true;
}

Output_t Composer::satisfy_request(Request_t request)
{
  // Check to see if our current event matches the request.
  // Get the event specified in the request.
  // Build the _consituent map, including mutexes.
  // Start a thread pool
  // For each order in request/pointers:
  //   new thread (get_or_compose(pointer))
  // Wait for all threads to end.
  // Copy data from _consituents to the result.
  // output[pointer] = get_or_compose(pointer);
  // The get_or_compose
  return Output_t(nullptr);
}
  
int64_t Composer::find_entry_in_tree(TTree* inTree, std::string& inSelection, int64_t inStart, int64_t inEnd, std::string& error)
{ 
  // Utility function for finding events in a TTree.
  // Returns an entry number, with event loaded.
  // inStart is the first event we should consider to match. Used when doing next_event
  // If we are doing a backwards search, we set inStart to be negative.
  // inEnd is the last event we should consider. Used when doing prev_event
  // inSelection is a selection that we should apply to the tree.
 
  // OK, find the entry in question.
  if(!inTree) { error = "No tree found."; return -1; }
  
  int64_t nentries = inTree->GetEntriesFast();
  if(nentries<1){
    return -2;
    error = std::string("No entries in tree") + inTree->GetName(); 
    return -1;
  }

  // Scan through entries, looking for specified selection.
  TTreeFormula* select = new TTreeFormula("Selection",inSelection.c_str(),inTree);
  if (!select) {
      error = "Could not create TTreeFormula.";
      return -1;
  }
  if (!select->GetNdim()) {
    delete select;
    error = "Problem with your selection function..";
    return -1;
  }

  int64_t jentry;
  bool match = false;
  if( inStart >=0 ) {
    // Forward search, situation normal
    int64_t stop = nentries;
    if(inEnd>0 && inEnd<stop) stop = inEnd;
    for (jentry=inStart; jentry<stop; jentry++) {
      // cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      inTree->LoadTree(jentry);
      // Does the selection match any part of the tree?
      int nsel = select->GetNdata();
      for(int i=0;i<nsel;i++) {
        if(select->EvalInstance(i) != 0){
          match = true; break;
        }
      }
      if(match) break;
    }
  } else {
    // inStart<0 : backward search
    int64_t start = nentries+inStart;
    if(start>=nentries) start = nentries-1;
    if(start<0) start = 0;
    int64_t stop = 0;
    if(inEnd>0 && inEnd<=start) stop = inEnd;
    for (jentry=start; jentry>=stop; jentry--) {
      // cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      inTree->LoadTree(jentry);
      // Does the selection match any part of the tree?
      int nsel = select->GetNdata();
      for(int i=0;i<nsel;i++) {
        if(select->EvalInstance(i) != 0){
          match = true; break;
        }
      }
      if(match) break;
    }
  }
  delete select;
  if(!match) {
    error = "No events matched selection.";
    return -1;
  }
  return jentry; // The matched event.
}  

nlohmann::json Composer::monitor_data()
{
  nlohmann::json monitor;
  monitor["pid"] = gSystem->GetPid();
  // monitor["events_served"] = events_served;
  SysInfo_t sysinfo;  gSystem->GetSysInfo(&sysinfo);
  // CpuInfo_t cpuinfo;  gSystem->GetCpuInfo(&cpuinfo);
  MemInfo_t meminfo;  gSystem->GetMemInfo(&meminfo);
  ProcInfo_t procinfo; gSystem->GetProcInfo(&procinfo);
  
  monitor["OS"           ] =  sysinfo.fOS.Data();
  monitor["ComputerModel"] =  sysinfo.fModel.Data();
  monitor["CpuType"      ] =   sysinfo.fCpuType.Data();
  monitor["Cpus"         ] =   sysinfo.fCpus;
  monitor["CpuSpeed"     ] =   sysinfo.fCpuSpeed;
  monitor["PhysicalRam"  ] =   sysinfo.fPhysRam;
  
  monitor["MemTotal"     ] =   Form("%d MB",meminfo.fMemTotal);
  monitor["MemUsed"      ] =   Form("%d MB",meminfo.fMemUsed);
  monitor["MemFree"      ] =   Form("%d MB",meminfo.fMemFree);
  monitor["SwapTotal"    ] =   Form("%d MB",meminfo.fSwapTotal);
  monitor["SwapUsed"     ] =   Form("%d MB",meminfo.fSwapUsed);
  monitor["SwapFree"     ] =   Form("%d MB",meminfo.fSwapFree);
  
  monitor["CpuTimeUser"     ] =   procinfo.fCpuUser;
  monitor["CpuTimeSys"     ] =    procinfo.fCpuSys;
  monitor["MemResident"    ] =    Form("%f MB",procinfo.fMemResident/1000.);
  monitor["MemVirtual"     ] =    Form("%f MB",procinfo.fMemVirtual/1000.);
  
  monitor["WallClockTime"  ] =    ((long)gSystem->Now())/1000.;
  int dummy;
  m_result["composer"] = abi::__cxa_demangle(typeid(*this).name(),0,0,&dummy);
  return monitor;
}


std::string Composer::to_string(OutputType_t type)
{
  std::string s;
  if(type==kUnknown    ) s = "kUnknown";
  if(type&kEmpty       ) s+="kEmpty";
  if(type&kProgress    ) s+="kProgress";
  if(type&kPiecePreview) s+="kPiecePreview";
  if(type&kPiece       ) s+="kPiece";
  if(type&kRecord      ) s+="kRecord";
  if(type&kFinal       ) s+="kFinal";
  if(type&kError       ) s+="kError";
  if(type&kRetval      ) s+="kRetval";
  if(type&kRequest     ) s+="kRequest";
  return s;
}


std::string Composer::form_event_descriptor()
{
  std::string s = m_filename;
  s.append(std::to_string(m_entry));
  s.append(":");
  s.append(std::to_string((long)gSystem->Now()));
  return s;
}


void Composer::dispatch_piece(const nlohmann::json& p) {
  if(m_output_callback) {
     nlohmann::json out;
     out["event_descriptor"] = m_cur_event_descriptor;
     out["piece"] = p;
     Output_t ot(new std::string(out.dump()));
     m_output_callback(kPiece,ot);
     // std::cout << "dispatch piece" << *ot << std::endl;
  }
   // else {
    // std::cout << "No output callback!" << std::endl;
  // }
}



