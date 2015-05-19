//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "ResultComposer.h"
#include "RecordComposer.h"
#include "RawRecordComposer.h"
#include <TTree.h>
#include <TFile.h>
#include <TROOT.h>
#include <TSystem.h>
#include <TTreeFormula.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <exception>
#include <TTime.h>
#include "JsonElement.h"
#include "online_monitor/DaqFile.h"


using namespace std; 

UInt_t ResultComposer::events_served = 0;

TTime  gTimeStart;

ResultComposer::ResultComposer()
  : rootfile(0)
  , tree(0)
{
  
}


std::shared_ptr<std::string> ResultComposer::compose(
         const char* inOptions,
         const char* inFile,
         const char* inSelection,
         Long64_t inStart,
         Long64_t inEnd )
{

  long eventTimeStart = gSystem->Now();

  // Test code to see what serve_event.cgi will do if the process hangs on an event.
  // if(events_served>2)
  //   { while(true) {;} }


  // Do whatever input option looks best.
  std::string path(inFile);

  bool is_daqfile = false;

  const std::string daqSuffix(".ubdaq");
  if( path.length() >= daqSuffix.length() ) {
    is_daqfile = (0 == path.compare( path.length() - daqSuffix.length(), daqSuffix.length(), daqSuffix));
  }
  if(is_daqfile) compose_from_raw(inOptions,inFile,inSelection,inStart,inEnd);
  else           compose_from_art(inOptions,inFile,inSelection,inStart,inEnd);
  
  // Add profiling.
  long ElapsedServerTime = ((long)(gSystem->Now()) - eventTimeStart);
  result.add("ElapsedServerTime",ElapsedServerTime);
  std::cout << "ElapsedServerTime: " << ElapsedServerTime << std::endl;
  
  std::shared_ptr<std::string> outString(new std::string(result.str()));
  return outString;
}


void ResultComposer::compose_from_art(
         const char* inOptions,
         const char* inRootFile,
         const char* inSelection,
         Long64_t inStart,
         Long64_t inEnd )
{
  
  long eventTimeStart = gSystem->Now();

  // This is how to check options:
  // if( std::string::npos != options.find("+REFRESH")) oRefresh = true;

  // Find the file in the list
  // TFile* dst = (TFile*)gROOT->GetListOfFiles()->FindObject(inDstFile);
  // if(dst && oRefresh) { dst->Close(); delete dst; dst = NULL; }
  // if(!dst) dst = new TFile(inDstFile,"READ");

  rootfile = new TFile(inRootFile,"READ");
  if(rootfile->IsZombie()) {
    // Bad file.
    result.add("error",string("Cannot open file ") + inRootFile + " for reading.");
    return;
  }


  // Open the tree.
  TTree* tree = (TTree*) rootfile->Get("Events");

  if(!tree) {
    result.add("error",string("Could not open tree 'Events' on file ") + inRootFile);
    return;
  }


  // OK, find the entry in question.
  Long64_t nentries = tree->GetEntriesFast();
  if(nentries<1){
    result.add("error",string("No entries in tree in file ") + inRootFile);
    return;
  }

  // Scan through entries, looking for specified selection.
  TTreeFormula* select = new TTreeFormula("Selection",inSelection,tree);
  if (!select) {
      result.add("error","Could not create TTreeFormula.");
      return;
  }
  if (!select->GetNdim()) {
    delete select;
    result.add("error","Problem with your selection function..");
    return;
  }

  Long64_t jentry;
  bool match = false;
  if( inStart >=0 ) {
    // Forward search, situation normal
    Long64_t stop = nentries;
    if(inEnd>0 && inEnd<stop) stop = inEnd;
    for (jentry=inStart; jentry<stop; jentry++) {
      // cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      tree->LoadTree(jentry);
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
    Long64_t start = nentries+inStart;
    if(start>=nentries) start = nentries-1;
    if(start<0) start = 0;
    Long64_t stop = 0;
    if(inEnd>0 && inEnd<=start) stop = inEnd;
    for (jentry=start; jentry>=stop; jentry--) {
      cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      tree->LoadTree(jentry);
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
    result.add("error","Selection matched no events in file.");
    return;
  }

  JsonObject source;
  source.add("file",inRootFile);
  source.add("selection",inSelection);
  source.add("start",inStart);
  source.add("end",inEnd);
  source.add("entry",jentry);
  source.add("options",inOptions);
  source.add("numEntriesInFile",nentries);
  result.add("source",source);

  addMonitorData();
  //
  // Get it.
  //
  // Here's where all the joy happens.
  RecordComposer composer(result,tree,jentry,inOptions);
  composer.compose();

  long ElapsedServerTime = ((long)(gSystem->Now()) - eventTimeStart);
  result.add("ElapsedServerTime",ElapsedServerTime);
  std::cout << "ElapsedServerTime: " << ElapsedServerTime << std::endl;
}


void ResultComposer::compose_from_raw(
         const char* inOptions,
         const char* inFile,
         const char* inSelection,
         Long64_t inStart,
         Long64_t inEnd )
{
  
  long eventTimeStart = gSystem->Now();
  
  // This is how to check options:
  // if( std::string::npos != options.find("+REFRESH")) oRefresh = true;
  
  // Find the file in the list
  // TFile* dst = (TFile*)gROOT->GetListOfFiles()->FindObject(inDstFile);
  // if(dst && oRefresh) { dst->Close(); delete dst; dst = NULL; }
  // if(!dst) dst = new TFile(inDstFile,"READ");
  
  DaqFile daqfile(inFile);
  
  if(! daqfile.Good() ) {
    // Bad file. 
    result.add("error",string("Cannot open file ") + inFile + " for reading.");
    return;
  }
    
  // OK, find the entry in question.

  // Scan through entries, looking for specified selection.
  // Nope, let's not.
  std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record;

  try {
    record = daqfile.GetEvent(inStart);
  } catch ( std::exception& e ) {
    result.add("error",string("Cannot read or unpack event ") + std::to_string(inStart) + " in file " + inFile + " " + e.what());
    return;
  }
  
  if(!record) {
    result.add("error",string("Cannot read or unpack event ") + std::to_string(inStart) + " in file " + inFile);
    return;
  }
      
  JsonObject source;
  source.add("file",inFile);
  // source.add("selection",inSelection);
  source.add("start",inStart);
  source.add("end",inEnd);
  source.add("entry",inStart);
  source.add("options",inOptions);
  source.add("numEntriesInFile",daqfile.NumEvents());
  source.add("fileClosedCleanly",daqfile.ClosedCleanly());
  result.add("source",source);

  addMonitorData();

  // 
  // Get it.
  //
  // Here's where all the joy happens.
  RawRecordComposer composer(result,record,inOptions);
  // Set it so it doesn't generate subdirectories like it does in live
  composer.fCacheStoragePath     = "../datacache";
  composer.fCacheStorageUrl      = "datacache";
  composer.fCreateSubdirCache = false;
  composer.compose();

  // move files in datacache:
  // std::string finalDirName = composer.fCurrentEventDirname;
  // size_t pos = finalDirName.find(".working",0);
  // if(pos != std::string::npos) finalDirName.replace(pos,8,".event");
  // rename(composer.fCurrentEventDirname.c_str(),finalDirName.c_str());
  


  return;
}



void ResultComposer::addMonitorData()
{
  JsonObject monitor;
  monitor.add("pid",gSystem->GetPid());
  monitor.add("events_served",events_served);
  SysInfo_t sysinfo;  gSystem->GetSysInfo(&sysinfo);
  // CpuInfo_t cpuinfo;  gSystem->GetCpuInfo(&cpuinfo);
  MemInfo_t meminfo;  gSystem->GetMemInfo(&meminfo);
  ProcInfo_t procinfo; gSystem->GetProcInfo(&procinfo);
  
  monitor.add("OS"           , sysinfo.fOS.Data());
  monitor.add("ComputerModel", sysinfo.fModel.Data());
  monitor.add("CpuType"      ,  sysinfo.fCpuType.Data());
  monitor.add("Cpus"         ,  sysinfo.fCpus);
  monitor.add("CpuSpeed"     ,  sysinfo.fCpuSpeed);
  monitor.add("PhysicalRam"  ,  sysinfo.fPhysRam);

  monitor.add("MemTotal"     ,  Form("%d MB",meminfo.fMemTotal));
  monitor.add("MemUsed"      ,  Form("%d MB",meminfo.fMemUsed));
  monitor.add("MemFree"      ,  Form("%d MB",meminfo.fMemFree));
  monitor.add("SwapTotal"    ,  Form("%d MB",meminfo.fSwapTotal));
  monitor.add("SwapUsed"     ,  Form("%d MB",meminfo.fSwapUsed));
  monitor.add("SwapFree"     ,  Form("%d MB",meminfo.fSwapFree));

  monitor.add("CpuTimeUser"     ,  procinfo.fCpuUser);
  monitor.add("CpuTimeSys"     ,   procinfo.fCpuSys);
  monitor.add("MemResident"    ,   Form("%f MB",procinfo.fMemResident/1000.));
  monitor.add("MemVirtual"     ,   Form("%f MB",procinfo.fMemVirtual/1000.));

  monitor.add("WallClockTime"  ,   ((long)(gSystem->Now() - gTimeStart))/1000.);
  result.add("backend_monitor",monitor);
}



ResultComposer::~ResultComposer()
{
  // The reason for doing this here is that closing the file and garbage collection take ~20% of the time.
  // This lets the main routine deliver the result, then perform cleanup;
  
  // Always close the file - let's see if this stops memory leaks.
  if(rootfile) {
    rootfile->Close(); delete rootfile;
  } 
}



