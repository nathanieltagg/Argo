//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <TTree.h>
#include <TLeaf.h>
#include <TFile.h>
#include <TROOT.h>
#include <TH1F.h>
#include <TH1D.h>
#include <TLorentzVector.h>
#include "TBranchElement.h"
#include "TStreamerInfo.h"

#include "TVirtualCollectionProxy.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <time.h>
#include <math.h>
#include <stdio.h>
#include <TTreeFormula.h>

#include "RawRecordComposer.h"
#include "JsonElement.h"
#include "ColorMap.h"
#include "MakePng.h"
#include "RootToJson.h"
#include "WirePalette.h"
#include <stdlib.h>
#include <sys/stat.h>

#include "datatypes/eventRecord.h"

using namespace std;
using namespace gov::fnal::uboone::datatypes;
using gov::fnal::uboone::online::Plexus;



RawRecordComposer::RawRecordComposer(JsonObject& output,   
                                      std::shared_ptr<gov::fnal::uboone::datatypes::eventRecord> record, 
                                      const std::string options)
  : fOutput(output)
  , fRecord(record)
  , fOptions(options)
  , fmintdc(0)
  , fmaxtdc(0)
  , fPlexus()

{
  fPlexus.buildHardcoded();
  //fPlexus.buildFromPostgresql("postgresql","host=fnalpgsdev.fnal.gov port=5436 dbname=uboonedaq_dev user=uboonedaq_web password=argon!uBooNE")

  fCacheStoragePath     = "../live_event_cache"
  fCacheStorageUrl      = "live_event_cache";
  fCurrentEventDirname  = "live";
};
  
RawRecordComposer::~RawRecordComposer()
{
}


void RawRecordComposer::compose()
{
  // have the record unpack itself.
  fRecord->updateIOMode(IO_GRANULARITY_CHANNEL);
  
  std::string id = Form("r%08d_s%04d_e%08d"
                            ,fRecord->getGlobalHeaderPtr()->getRunNumber()    
                            ,fRecord->getGlobalHeaderPtr()->getSubrunNumber() 
                            ,fRecord->getGlobalHeaderPtr()->getEventNumber()  
                            );
  fCurrentEventDirname = Form("%s/%s.event/"
                            ,fCacheStoragePath.c_str(), id.c_str());
  fCurrentEventUrl      = Form("%s/%s.event/"
                            ,fCacheStorageUrl.c_str(), id.c_str());
  
  mkdir(fCurrentEventName,0777);
  composeHeader();
  composeTPC();
  composePMTs();

}

void RawRecordComposer::composeHeader()
{
  JsonObject header;
  header.add("run"     ,fRecord->getGlobalHeaderPtr()->getRunNumber()    );
  header.add("subrun"  ,fRecord->getGlobalHeaderPtr()->getSubrunNumber() );
  header.add("event"   ,fRecord->getGlobalHeaderPtr()->getEventNumber()  );
  header.add("triggerword"   , fRecord->getTriggerDataPtr()->getTrigEventType() );

  // time_t daqSec = fRecord->getGlobalHeader().getSeconds();
  // int daqNanoSec = (fRecord->getGlobalHeader().getMilliSeconds()*1000000)
  //                + (fRecord->getGlobalHeader().getMicroSeconds()*1000) // FIXME: Not sure if right.
  //                + (fRecord->getGlobalHeader().getNanoSeconds()); // FIXME: Not sure if right.

  header.add("recordOrigin", fRecord->getGlobalHeaderPtr()->getRecordOrigin());
  
  // Add my own things. 
  // FIXME: this should come from the event data, not be hardcoded, but this will have to do for the moment.
  header.add("TDCStart",fmintdc); // get from raw wire info.
  header.add("TDCEnd",fmaxtdc);
  
  fOutput.add("header",header);  
}
  
void wireOfChannel(int channel, int& plane, int& wire)
{
  if(channel < 2399) {
    plane = 0; wire= channel; return;
  }
  else if(channel <4798) {
    plane = 1; 
    wire = channel - 2399;
    return;
  }
  else{
    plane = 2;
    wire= channel-4798;
    return;
  }
}
  
void RawRecordComposer::composeTPC()
{
  if(!fPlexus.is_ok()) cerr << "Plexus not loaded!" << std::endl;
  // The big wire map.
  typedef std::vector<int16_t> waveform_t;
  typedef std::shared_ptr<waveform_t> waveform_ptr_t;
  typedef std::map<int, waveform_ptr_t > wiremap_t;

  wiremap_t wireMap;
  int ntdc = 0;
  
  int wires_read = 0;
  // Loop through all channels.
  std::map<crateHeader,crateData,compareCrateHeader> seb_map = fRecord->getSEBMap();
  std::map<crateHeader,crateData,compareCrateHeader>::iterator seb_it;
  for( seb_it = seb_map.begin(); seb_it != seb_map.end(); seb_it++){
    //get the crateHeader/crateData objects
    crateHeader crate_header = seb_it->first;
    crateData crate_data = seb_it->second;
    int crate = crate_header.getCrateNumber();
    if(crate<10) {// FIXME don't hardcode this?

      //now get the card map (for the current crate), and do a loop over all cards
      std::map<cardHeader,cardData>::iterator card_it;
      std::map<cardHeader,cardData,compareCardHeader> card_map = crate_data.getCardMap();
      for(card_it = card_map.begin(); card_it != card_map.end(); card_it++){
    
        cardHeader card_header = card_it->first;
        cardData card_data = card_it->second;
        int card = card_header.getID();
        
        
        
        std::map<int,channelData> channel_map = card_data.getChannelMap();
        std::map<int,channelData>::iterator channel_it;
        for(channel_it = channel_map.begin(); channel_it != channel_map.end(); channel_it++){

          int channel       = channel_it->first;
          channelData& data = channel_it->second;

          // Find the wire number of this channel.
          Plexus::PlekPtr_t p = fPlexus.get(crate,card,channel);
          int wire = p->wirenum();
          // std::cout << "found wire " << wire << std::endl;
          if(wire<0) continue;

          // FIXME: not right for huffman.
          int nsamp = data.getChannelDataSize()/sizeof(uint16_t);

          // Waveform storage.
          std::pair<wiremap_t::iterator,bool> inserted;
          waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(nsamp));
          inserted = wireMap.insert(wiremap_t::value_type(wire, waveform_ptr));
          if(!inserted.second) {
            cerr << "Two channels with wire number " << wire << " seem to have the same crate/card/channel map." << endl;
            continue;
          }
          waveform_t& waveform = *(inserted.first->second.get());
                  
          // Copy the channel data to my own signed vector array
          // FIXME: do huffman decoding or decimation recover here!
          uint16_t* rawdata = (uint16_t*)(data.getChannelDataPtr());
          for(int i=0;i<nsamp;i++) waveform[i] = rawdata[i];
          
          wires_read++;
          if(ntdc<nsamp) ntdc = nsamp;
          
          // Find the pedestal manually.
          // FIXME: add configurable hook to look up.
          // Histogram of values:
          vector<uint16_t> histogram(0x1000,0);
          int16_t pedestal = 0;
          uint16_t max_counts = 0;
          for(int i=0;i<nsamp;i++){
            int bin = waveform[i]&0xFFF;
            int counts = ++histogram[bin];
            if(counts > max_counts) { max_counts = counts; pedestal = bin;}
          } 
          
          // subtract ped.
          for(int i=0;i<nsamp;i++){
            waveform[i] -= pedestal;
          }
        } // loop channels
      } // loop cards
    } // if TPC crate
  } // loop seb/crate
  
  // Now we should have a semi-complete map.
  // Make the output.
  fmintdc = 0;
  fmaxtdc = ntdc;

  if(wires_read<=0) cerr << "Got no wires!" << std::endl;
  int nwire = 8254;
  ColorMap colormap;
  MakePng png (ntdc,nwire, MakePng::palette_alpha,WirePalette::gWirePalette->fPalette,WirePalette::gWirePalette->fPaletteTrans);
  MakePng epng(ntdc,nwire,MakePng::rgb);
  std::vector<unsigned char> imagedata(ntdc);
  std::vector<unsigned char> encodeddata(ntdc*3);

  TH1D timeProfile("timeProfile","timeProfile",ntdc,0,ntdc);
  std::vector<TH1*> planeProfile;
  std::vector<Double_t> timeProfileData(ntdc+2,0);
  planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
  planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
  planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));
  // waveform_t blank(ntdc,0);
  for(int wire=0;wire<nwire;wire++) 
  {
    // waveform_t& waveform = blank;
    wiremap_t::iterator it = wireMap.find(wire);
    if(it != wireMap.end()) {
      // We have a good wire recorded.0
      waveform_t& waveform = *(it->second.get());

      double wiresum = 0;
      for(int k=0;k<ntdc;k++) {
        short raw = waveform[k];
        // colormap.get(&imagedata[k*3],float(raw)/4000.);
        imagedata[k] = WirePalette::gWirePalette->tanscale(raw);
        // Save bitpacked data as image map.
        int iadc = raw + 0x8000;
        encodeddata[k*3]   = 0xFF&(iadc>>8);
        encodeddata[k*3+1] = iadc&0xFF;
        encodeddata[k*3+2] = 0;
        double val = fabs(raw);
        wiresum += val;
        //timeProfile.Fill(k,val);
        timeProfileData[k+1] += val;
      }
      png.AddRow(imagedata);
      epng.AddRow(encodeddata);
      
      int plane, planewire;
      wireOfChannel(wire,plane,planewire);
      planeProfile[plane]->Fill(planewire,wiresum);
    } else {
      // Do not have wire info.
      
      for(int k=0;k<ntdc;k++) {
        imagedata[k] = 255; // Saturate!
        // Save bitpacked data as image map.
        encodeddata[k*3]   = 0;
        encodeddata[k*3+1] = 0;
        encodeddata[k*3+2] = 0;
      }
      png.AddRow(imagedata);
      epng.AddRow(encodeddata);      
    }
    
  }
  timeProfile.SetContent(&timeProfileData[0]);
  png.Finish();
  epng.Finish();
  std::string wireimg = png.writeToUniqueFile(fCurrentEventDirname);
  std::string wireimg_thumb = wireimg+".thumb.png";
  BuildThumbnail(fCurrentEventDirname+wireimg,fCurrentEventDirname+wireimg_thumb);

  JsonObject r;
  r.add("wireimg_url",sfUrlToFileStorage+wireimg);
  r.add("wireimg_url_thumb",sfUrlToFileStorage+wireimg_thumb);
  r.add("wireimg_encoded_url",sfUrlToFileStorage+
                            epng.writeToUniqueFile(sfFileStoragePath)
                            );

  r.add("timeHist",TH1ToHistogram(&timeProfile));
  JsonArray jPlaneHists;
  jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
  jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
  jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
  r.add("planeHists",jPlaneHists);

  delete planeProfile[0];
  delete planeProfile[1];
  delete planeProfile[2];

  JsonObject reco_list;
  reco_list.add("DAQ",r);
  fOutput.add("raw",reco_list);
    
  
}
  
void RawRecordComposer::composePMTs()
{
  
}
  
