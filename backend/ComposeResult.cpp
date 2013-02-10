//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "ComposeResult.h"
#include <TTree.h>
#include <TFile.h>
#include <TROOT.h>
#include <TSystem.h>
#include <TTreeFormula.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include "ComposeRecord.h"


using namespace std; 

static UInt_t events_served = 0;

TTime  gTimeStart;

string ComposeResult(
         const char* inOptions,
         const char* inRootFile,
         const char* inSelection,
         Long64_t inStart,
         Long64_t inEnd )
{
  events_served++;

  // Test code to see what serve_event.cgi will do if the process hangs on an event.
  // if(events_served>2)
  //   { while(true) {;} }

  long eventTimeStart = gSystem->Now();

  // Parse options
  std::string options(inOptions);
  
  // This is how to check options:
  // if( std::string::npos != options.find("+REFRESH")) oRefresh = true;

  // Start building the output.
  JsonObject result;
  
  // Find the file in the list
  // TFile* dst = (TFile*)gROOT->GetListOfFiles()->FindObject(inDstFile);
  // if(dst && oRefresh) { dst->Close(); delete dst; dst = NULL; }
  // if(!dst) dst = new TFile(inDstFile,"READ");
  
  TFile* rootfile = new TFile(inRootFile,"READ");
  if(rootfile->IsZombie()) {
    // Bad file. 
    result.add("error",string("Cannot open file ") + inRootFile + " for reading.");
    return result.str();
  }
  
  
  // Open the tree.
  TTree* tree = (TTree*) rootfile->Get("Events");
  
  if(!tree) {
    rootfile->Close(); delete rootfile;
    result.add("error",string("Could not open tree 'Events' on file ") + inRootFile);
    return result.str();
  }
  
  
  // OK, find the entry in question.
  Long64_t nentries = tree->GetEntriesFast();  
  if(nentries<1){
    result.add("error",string("No entries in tree in file ") + inRootFile);
    rootfile->Close(); delete rootfile;
    return result.str();
  }
  
  // Scan through entries, looking for specified selection.
  TTreeFormula* select = new TTreeFormula("Selection",inSelection,tree);
  if (!select) {
      result.add("error","Could not create TTreeFormula.");
      rootfile->Close(); delete rootfile;
      return result.str();
  }
  if (!select->GetNdim()) { 
    delete select;
    result.add("error","Problem with your selection function..");
    rootfile->Close(); delete rootfile;
    return result.str();
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
    rootfile->Close(); delete rootfile;
    return result.str();
  } 
  

  // This is a good time to figure out the software version information.
  
  JsonObject source;
  source.add("file",inRootFile);
  source.add("selection",inSelection);
  source.add("start",inStart);
  source.add("end",inEnd);
  source.add("entry",jentry);
  source.add("numEntriesInFile",nentries);
  result.add("source",source);

  JsonObject monitor;
  monitor.add("pid",gSystem->GetPid());
  monitor.add("events_served",events_served);
  SysInfo_t sysinfo;  gSystem->GetSysInfo(&sysinfo);
  // CpuInfo_t cpuinfo;  gSystem->GetCpuInfo(&cpuinfo);
  MemInfo_t meminfo;  gSystem->GetMemInfo(&meminfo);
  ProcInfo_t procinfo; gSystem->GetProcInfo(&procinfo);
  
  monitor.add("OS"           , sysinfo.fOS.Data());
  monitor.add("ComputerModel", sysinfo.fModel);
  monitor.add("CpuType"      ,  sysinfo.fCpuType);
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

  // 
  // Get it.
  //
  Int_t bytesRead = tree->GetEntry(jentry,1);
  if(bytesRead<0) {
    cout << "Error: I/O error on GetEntry trying to read entry " << jentry;
    result.add("error","I/O error on GetEntry");
    rootfile->Close(); delete rootfile;
    return result.str();
  }
  if(bytesRead==0) {
    cout << "Error: Nonexistent entry reported by GetEntry trying to read entry " << jentry;
    result.add("error","Entry does not exist on tree");
    rootfile->Close(); delete rootfile;
    return result.str();

  }


  // Here's where all the joy happens.
  ComposeRecord(result,tree,jentry);

  // Always close the file - let's see if this stops memory leaks.
  rootfile->Close(); delete rootfile;
  
  result.add("ElapsedServerTime",((long)(gSystem->Now()) - eventTimeStart));
  
  return result.str();
}



