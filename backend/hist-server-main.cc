//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <stdlib.h>
#include <stdio.h>
#include <iostream>
#include <fstream>

#include <TROOT.h>
#include <TRint.h>
#include <TStyle.h>
#include <TSystem.h>
#include <TTimeStamp.h>
#include <TError.h>

#include "SocketServer.h"
#include "JsonElement.h"
#include "TFile.h"
#include "TH1.h"
#include "TH2.h"

TTime gTimeStart;

JsonObject TH2ToHistogram( TH2* hist )
{
  JsonObject h;
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("name",hist->GetName());
  h.add("title",hist->GetTitle());
  h.add("xlabel",hist->GetXaxis()->GetTitle());
  h.add("ylabel",hist->GetYaxis()->GetTitle());
  h.add("n_x",hist->GetNbinsX());
  h.add("min_x",hist->GetXaxis()->GetXmin());
  h.add("max_x",hist->GetXaxis()->GetXmax());
  h.add("n_x",hist->GetNbinsY());
  h.add("min_y",hist->GetYaxis()->GetXmin());
  h.add("max_y",hist->GetYaxis()->GetXmax());

  double tot = hist->GetSumOfWeights();
  h.add("total",tot);
  JsonArray data;
  for(int i=1; i <= hist->GetNbinsX();i++) {
    JsonArray data2;
    for(int j=1; j<= hist->GetNbinsY(); j++) {
      data2.add(hist->GetBinContent(hist->GetBin(i,j)));
    }
    data.add(data2);
  }
  h.add("data",data);
  return h;
}
JsonObject TH1ToHistogram( TH1* hist )
{
  JsonObject h;
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("name",hist->GetName());
  h.add("title",hist->GetTitle());
  h.add("xlabel",hist->GetXaxis()->GetTitle());
  h.add("ylabel",hist->GetYaxis()->GetTitle());
  h.add("n",hist->GetNbinsX());
  h.add("min",hist->GetXaxis()->GetXmin());
  h.add("max",hist->GetXaxis()->GetXmax());
  h.add("underflow",hist->GetBinContent(0));
  h.add("overflow",hist->GetBinContent(hist->GetNbinsX()+1));
  double tot = hist->GetSumOfWeights();
  h.add("total",tot);
  h.add("sum_x",tot*hist->GetMean());
  h.add("max_content",hist->GetMaximum());
  h.add("min_content",hist->GetMinimum());
  JsonArray data;
  for(int i=1; i <= hist->GetNbinsX();i++) {
    data.add(hist->GetBinContent(i));
  }
  h.add("data",data);
  return h;
}

using namespace std;

VoidFuncPtr_t initfuncs[] = { 0 };
TROOT root("Rint", "The ROOT Interactive Interface", initfuncs);
void MyErrorHandler(int level, Bool_t abort, const char *location, const char *msg);

class MySocketServer : public SocketServer{
public:
  MySocketServer( int port ) : SocketServer(port) {};
  virtual ~MySocketServer() {};
  
  size_t SufficientData( const unsigned char* inData, size_t inSize, size_t inMaxSize) 
  { 
    static char options[100];
    static char filename[990];
    static char histname[990];
    int bytes;
    int r =  sscanf((char*)inData,"%99[^,\n],%900[^,\n],%900[^,\n]\n%n",options,filename,histname,&bytes);
    if(r==3) return bytes;
    return 0;
  };
};


vector<string> split(   /* Altered/returned value */
       const  string  & theString,
       const  string  & theDelimiter)
{
  vector<string> theStringVector;
  size_t  start = 0, end = 0;
  while ( end != string::npos) {
      end = theString.find( theDelimiter, start);
      theStringVector.push_back( theString.substr( start,
                     (end == string::npos) ? string::npos : end - start));
      start = (   ( end > (string::npos - theDelimiter.size()) )
                ?  string::npos  :  end + theDelimiter.size());
  }
  return theStringVector;
}

void getObjListing(TDirectory* dir, std::string path, JsonArray &arr)
{
  TList* l = dir->GetListOfKeys();
  TObject *obj;
  TIter nextobj(l);
  while ((obj = (TObject *) nextobj())) {
     TDirectory* subdir = 0;
     dir->GetObject<TDirectory>(obj->GetName(),subdir);
     if(subdir) getObjListing(subdir,path+obj->GetName()+"/",arr);
     else       arr.add(path+obj->GetName());
 } 
}


std::string ComposeResult(const std::string& filename, const std::string& histname, const std::string& options)
{
  // Now do your stuff.
  
  // open file:
  JsonObject result;
  TFile* f = new TFile(filename.c_str(),"READ");
  if(f->IsZombie()) {
    result.add("error","Could not find filename "+filename);
    delete f;
    return result.str();
  }
  
  // Create metata object showing state of file.
  JsonObject cycle;
  
  TTimeStamp *cycletime = 0;
  f->GetObject("updateTimeStamp",cycletime);
  if(cycletime) {
    // Javascript likes the near ISO-8601 compliant version, lets use that.
    cycle.add("time",cycletime->AsString("c"));
  }
  TNamed* nmd;
  f->GetObject("run",nmd);    if(nmd) cycle.add(nmd->GetName(),nmd->GetTitle());
  f->GetObject("subrun",nmd); if(nmd) cycle.add(nmd->GetName(),nmd->GetTitle());
  f->GetObject("event",nmd);  if(nmd) cycle.add(nmd->GetName(),nmd->GetTitle());
    
  // Seperate space-delimited listing of histname objects.
  vector<string> histnames = split(histname,":");
  
  for(int ih=0;ih<histnames.size();ih++) {
    std::string hname = histnames[ih];

    // Handle special case requests
    if(hname == "LIST") {
      JsonArray arr;
      getObjListing(f,"",arr);
      JsonObject thing;
      thing.add("cycle",cycle);
      thing.add("data",arr);    
      result.add("LIST",thing);
      
      
    } else {
    
      // Lets' look for a pathname
      // Find directory and object
      std::string name;
      std::string path;
      size_t pos = hname.find_last_of("/");
      if(pos != std::string::npos){
        path.assign(hname,0,pos);
        name.assign(hname.begin()+pos+1,hname.end());
      } else {
        path = "";
        name = hname;
      }
      TDirectory* dir = f->GetDirectory(path.c_str(), false);
      if(!dir) {
        result.add("error","Could not find path "+path);
        delete f;
        return result.str();
      }
  
      // Attempt to find object.
      TObject* o = dir->Get(name.c_str());
      if(!o) {
        result.add("error","Could not find object "+name);
        delete f;
        return result.str();
      }
  
      JsonObject jobj;
      if(o->InheritsFrom(TH2::Class()))      jobj = TH2ToHistogram((TH2*)o);
      else if(o->InheritsFrom(TH1::Class())) jobj = TH1ToHistogram((TH1*)o);
    
      JsonObject thing;
      thing.add("cycle",cycle);
      thing.add("data",jobj);    
      result.add(hname,thing);
    }
  }
  return result.str();
}

int main(int argc, char **argv)
{
  try{

  int tcpPortNumber = 8013;
  if(argc>1) {
    sscanf(argv[1],"%d",&tcpPortNumber);
  }
  cout << argv[0] << "starting up at " <<  TTimeStamp().AsString() << " on port " << tcpPortNumber << endl;
  
  SetErrorHandler(MyErrorHandler);

  MySocketServer ss(tcpPortNumber);
  if(ss.Setup()) exit(1);  // Quit if socket won't bind.

  // write a PID file.
  {
    std::string pidfilename = std::string( argv[0] ) + ".pid";
    ofstream pidfile(pidfilename.c_str());
    pidfile << gSystem->GetPid();
    pidfile.close();
  }

  gTimeStart = gSystem->Now();

  while (1) {
    //cout << ".";
    //cout.flush();
    ss.CheckForBadClients();
    
    unsigned char* dataRecvd;
    int   client;
    bool  newClient;
    ss.Listen(100., // seconds timeout
              1000, // bytes max
              dataRecvd, // data recieved in message
              client,    // fd number of client.
              newClient  // true if a new client connected.
              );
    if(newClient) {
      cout << "New client " << client << endl;
    }
    
    if(dataRecvd) {
      // Try to parse format of FILENAME,GATE\n
      char options[100];
      char filename[990];
      char histname[990];
      int r = sscanf((char*)dataRecvd,"%99[^,\n],%900[^,\n],%900[^,\r\n]",options,filename,histname);
      if(r==3) {
        //Successful conversion. Give it a try.
        cout << "Got a valid request at " << TTimeStamp().AsString() << endl;
        cout << "    Filename: --" << filename << "--" << endl;
        cout << "    Histname :--" << histname << "--" << endl;
        cout << "    Options:  --" << options << endl;

        std::string str = ComposeResult(filename,histname,options);
        // Send it out.
        ss.SendTo(client, (unsigned char*) str.c_str(),  str.length() );
        cout << "Request served." << endl;
        ss.Close(client);
      }

    }
  }
  }
  catch(...) {
    cout << "Exception!" << endl;
    exit(2);
  }
}


void MyErrorHandler(int level, Bool_t abort, const char *location, const char *msg)
{
  // Suppress warning messages about branch sets.
  TString m(msg);
  if(m.BeginsWith("unknown branch")) return;
  
  DefaultErrorHandler(level, abort, location, msg);
//  exit(1);
}
