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
#include "TimeReporter.h"
#include "ColorMap.h"
#include "MakePng.h"
#include "EncodedTileMaker.h"
#include "RootToJson.h"
#include "WirePalette.h"
#include <stdlib.h>
#include <sys/stat.h>

#include "datatypes/ub_EventRecord.h"

#include "boost/thread/thread.hpp"

using namespace std;
using namespace gov::fnal::uboone::datatypes;
using gov::fnal::uboone::online::Plexus;

gov::fnal::uboone::online::Plexus gPlexus;


RawRecordComposer::RawRecordComposer(JsonObject& output,   
                                      std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, 
                                      const std::string options)
  : fOutput(output)
  , fRecord(record)
  , fOptions(options)
  , fCreateSubdirCache (true)
  , fmintdc(0)
  , fmaxtdc(0)
{

  fCacheStoragePath     = "../live_event_cache";
  fCacheStorageUrl      = "live_event_cache";
};
  
RawRecordComposer::~RawRecordComposer()
{
}


void RawRecordComposer::compose()
{
  // have the record unpack itself.
  //fRecord->updateIOMode(IO_GRANULARITY_CHANNEL);
  
  std::string id = Form("r%08d_s%04d_e%08d"
                            ,fRecord->getGlobalHeader().getRunNumber()    
                            ,fRecord->getGlobalHeader().getSubrunNumber() 
                            ,fRecord->getGlobalHeader().getEventNumber()  
                            );
  
  if(fCreateSubdirCache) {
    fCurrentEventDirname = Form("%s/%s.%s/" // Will get renamed to .event on closeout.
                              ,fCacheStoragePath.c_str(), id.c_str(),fWorkingSuffix.c_str());
    fCurrentEventUrl      = Form("%s/%s.%s/"
                              ,fCacheStorageUrl.c_str(), id.c_str(),fFinalSuffix.c_str());
  
    mkdir(fCurrentEventDirname.c_str(),0777);
  } else {
    fCurrentEventDirname = fCacheStoragePath;
    fCurrentEventUrl     = fCacheStorageUrl;
  }
  composeHeader();
  composeTPC();
  composePMTs();
  fOutput.add("stats",fStats);
  

}

void RawRecordComposer::composeHeader()
{
  JsonObject header;
  header.add("run"           ,fRecord->getGlobalHeader().getRunNumber()    );
  header.add("subrun"        ,fRecord->getGlobalHeader().getSubrunNumber() );
  header.add("event"         ,fRecord->getGlobalHeader().getEventNumber()  );
  header.add("triggerword"   , fRecord->triggerData().getTrigEventType() );

  header.add("seconds",fRecord->getGlobalHeader().getSeconds());
  header.add("microSeconds",fRecord->getGlobalHeader().getMicroSeconds());
  header.add("nanoSeconds",fRecord->getGlobalHeader().getNanoSeconds());
  int daqSec = fRecord->getGlobalHeader().getSeconds();
  int daqNanoSec = (fRecord->getGlobalHeader().getNanoSeconds()); // FIXME: Not sure if right.
  double daqtime = daqSec*1000 + daqNanoSec*1e-9;
  
  header.add("daqTime",daqtime);
  header.add("recordOrigin", fRecord->getGlobalHeader().getRecordOrigin());
  
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
  JsonObject reco_list;
  JsonObject r;
  
  if(!gPlexus.is_ok()) cerr << "Plexus not loaded!" << std::endl;
  // The big wire map.
    
  JsonObject jTPC;
  JsonArray jCrates;

  std::shared_ptr<wiremap_t> wireMap(new wiremap_t);
  int ntdc = 0;
  TimeReporter timer("TPC");    
  
  int wires_read = 0;
  
  {
    TimeReporter timer_read("TPCReadDAQ");  
    
    // Loop through all channels.
    ub_EventRecord::tpc_map_t tpc_map = fRecord->getTPCSEBMap();
    for( ub_EventRecord::tpc_map_t::const_iterator crate_it = tpc_map.begin(); crate_it != tpc_map.end(); crate_it++){
      //get the crateHeader/crateData objects
      int crate = crate_it->first; // This seems more reliable than the crate daq header.
      const tpc_crate_data_t& crate_data = crate_it->second;
      std::unique_ptr<tpc_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();

      JsonArray jCards;

      std::vector<tpc_crate_data_t::card_t> const& cards = crate_data.getCards();
      for(const tpc_crate_data_t::card_t& card_data: cards) {
        // const tpc_crate_data_t::card_t::ub_CardHeader_t& card_header = card_data.getHeader();
        int card = card_data.getModule();
      
        JsonObject jCard;
        jCard.add("cardId",crate);
        int num_card_channels = 0;
        
        const std::vector<tpc_crate_data_t::card_t::card_channel_type>& channels = card_data.getChannels();
        for( const tpc_crate_data_t::card_t::card_channel_type& channel_data : channels) {
          int channel       = channel_data.getChannelNumber();        
          num_card_channels++;
          // Find the wire number of this channel.
          const Plexus::Plek& p = gPlexus.get(crate,card,channel);
          int wire = p.wirenum();
          // std::cout << "found wire " << wire << std::endl;
          if(wire<0) continue;
          size_t nsamp = channel_data.data().size();

          // Waveform storage.
          std::pair<wiremap_t::iterator,bool> inserted;
          waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(nsamp));
          inserted = wireMap->insert(wiremap_t::value_type(wire, waveform_ptr));
          if(!inserted.second) {
            cerr << "Two channels with wire number " << wire << " seem to have the same crate/card/channel map." << endl;
            continue;
          }
          waveform_t& waveform = *(inserted.first->second.get());
                  
          // Copy the channel data to my own signed vector array
          channel_data.decompress(waveform);
        
          wires_read++;
          if(ntdc<nsamp) ntdc = nsamp;
          
          // Find the pedestal manually.
          // FIXME: add configurable hook to look up.
          // Histogram of values:
          vector<uint16_t> histogram(0x1000,0);
          int16_t pedestal = 0;
          uint16_t max_counts = 0;
          for(int i=0;i<nsamp;i++){
            int bin = waveform[i];
            int counts = ++histogram[bin];
            if(counts > max_counts) { max_counts = counts; pedestal = bin;}
          } 
        
          // subtract ped.
          for(int i=0;i<nsamp;i++){
            waveform[i] -= pedestal;
          }
        } // loop channels

        jCard.add("num_channels",num_card_channels);
        jCards.add(jCard);        
      } // loop cards
    
      JsonObject jCrate;
      jCrate.add("cards",jCards);
      jCrate.add("crateNumber",crate);
      jCrate.add("cardCount",cards.size());
      jCrate.add("sebSec",crate_header->local_host_time.seb_time_sec);
      jCrate.add("sebUsec",crate_header->local_host_time.seb_time_usec);
      jCrate.add("type",crate_header->crate_type);
      jCrate.add("eventNumber",crate_header->event_number);
      jCrate.add("frameNumber",crate_header->frame_number);
      jCrate.add("cardCount",crate_header->card_count);
      jCrates.add(jCrate);
      
    } // loop seb/crate
  
    timer_read.addto(fStats);
  }
  
  // Now we should have a semi-complete map.
  fmintdc = 0;
  fmaxtdc = ntdc;
  int nwire = 8254;
  if(wires_read<=0) { cerr << "Got no wires!" << std::endl; return;}
  cout << "Read " << wires_read << " wires\n";
  
  {
    TimeReporter timer_tiles("TPCMakeTiles");
    // create tiles.
 
    std::cout << "Doing tile threads"<< std::endl;
    boost::thread_group tile_threads;
  
    EncodedTileMaker tile_plane0window1( wireMap, 0, 2399, 0,    3200   , fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane0window2( wireMap, 0, 2399, 3200, 6400   , fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane0window3( wireMap, 0, 2399, 6400, ntdc   , fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane1window1( wireMap, 2399, 4798, 0,    3200, fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane1window2( wireMap, 2399, 4798, 3200, 6400, fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane1window3( wireMap, 2399, 4798, 6400, ntdc, fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane2window1( wireMap, 4798, 8254, 0,    3200, fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane2window2( wireMap, 4798, 8254, 3200, 6400, fCurrentEventDirname, fCurrentEventUrl ); 
    EncodedTileMaker tile_plane2window3( wireMap, 4798, 8254, 6400, ntdc, fCurrentEventDirname, fCurrentEventUrl ); 

    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane0window1));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane0window2));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane0window3));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane1window1));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane1window2));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane1window3));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane2window1));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane2window2));
    tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tile_plane2window3));
    tile_threads.join_all();
  
    std::cout << "Finished tile threads"<< std::endl;
  
    JsonArray tiles1; 
    tiles1.add(tile_plane0window1.json());
    tiles1.add(tile_plane0window2.json());
    tiles1.add(tile_plane0window3.json());
    JsonArray tiles2; 
    tiles2.add(tile_plane1window1.json());
    tiles2.add(tile_plane1window2.json());
    tiles2.add(tile_plane1window3.json());
    JsonArray tiles3; 
    tiles3.add(tile_plane2window1.json());
    tiles3.add(tile_plane2window2.json());
    tiles3.add(tile_plane2window3.json());
    JsonArray tiles;
    tiles.add(tiles1);
    tiles.add(tiles2);
    tiles.add(tiles3);
    
    r.add("wireimg_encoded_tiles",tiles);
    
    timer_tiles.addto(fStats);    
  }
  
  
  // make stats.
  {
    TimeReporter timer_stats("TPCMakeStats");
    TH1D timeProfile("timeProfile","timeProfile",ntdc,0,ntdc);
    std::vector<TH1*> planeProfile;
    std::vector<Double_t> timeProfileData(ntdc+2,0);
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));
    // waveform_t blank(ntdc,0);
    for(int wire=0;wire<nwire;wire++) 
    {
      wiremap_t::iterator it = wireMap->find(wire);
      if(it != wireMap->end()) {
        waveform_t& waveform = *(it->second.get());
        double wiresum = 0;
              
        for(int k=0;k<ntdc;k++) {        
          short raw = waveform[k];
          double val = fabs(raw);
          wiresum += val;
          timeProfileData[k+1] += val;
        }
        int plane, planewire;
        wireOfChannel(wire,plane,planewire);
        planeProfile[plane]->Fill(planewire,wiresum);
      }
    }
    timeProfile.SetContent(&timeProfileData[0]);
    
    r.add("timeHist",TH1ToHistogram(&timeProfile));
    JsonArray jPlaneHists;
    jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
    r.add("planeHists",jPlaneHists);

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];


    timer_stats.addto(fStats);
  }
  
  // Create images.
/*  
  {
    TimeReporter timer_pngs("TPCMakePmgs");
    
    ColorMap colormap;
    // All of the wire data is now contained in a the wireMap, which is a collection of vectors (one per wire)
    MakePng png (ntdc,nwire, MakePng::palette_alpha,WirePalette::gWirePalette->fPalette,WirePalette::gWirePalette->fPaletteTrans);
    // MakePng epng(ntdc,nwire,MakePng::rgb);
    std::vector<unsigned char> imagedata(ntdc);
    // std::vector<unsigned char> encodeddata(ntdc*3);

    // waveform_t blank(ntdc,0);
    for(int wire=0;wire<nwire;wire++) 
    {
      // waveform_t& waveform = blank;
      wiremap_t::iterator it = wireMap->find(wire);
      if(it != wireMap->end()) {
        // We have a good wire recorded.0
        waveform_t& waveform = *(it->second.get());

        for(int k=0;k<ntdc;k++) {
          short raw = waveform[k];
          // colormap.get(&imagedata[k*3],float(raw)/4000.);
          imagedata[k] = WirePalette::gWirePalette->tanscale(raw*3);
          // // Save bitpacked data as image map.
          // int iadc = raw + 0x8000;
          // encodeddata[k*3]   = 0xFF&(iadc>>8);
          // encodeddata[k*3+1] = iadc&0xFF;
          // encodeddata[k*3+2] = 0;
        }
        png.AddRow(imagedata);
        // epng.AddRow(encodeddata);
      } else {
        // Do not have wire info.      
        for(int k=0;k<ntdc;k++) {
          imagedata[k] = 255; // Saturate!
          // // Save bitpacked data as image map.
          // encodeddata[k*3]   = 0;
          // encodeddata[k*3+1] = 0;
          // encodeddata[k*3+2] = 0;
        }
        png.AddRow(imagedata);
        // epng.AddRow(encodeddata);
      }
    
    }
    cout << "Loaded pngs\n";
    png.Finish();
    // epng.Finish();
    cout << "Finished  pngs\n";
  
    std::string wireimg = png.writeToUniqueFile(fCurrentEventDirname);
    std::string wireimg_thumb = wireimg+".thumb.png";
    BuildThumbnail(fCurrentEventDirname+wireimg,fCurrentEventDirname+wireimg_thumb);

    r.add("wireimg_url",fCurrentEventUrl+wireimg);
    r.add("wireimg_url_thumb",fCurrentEventUrl+wireimg_thumb);
    // r.add("wireimg_encoded_url",fCurrentEventUrl+
    //                           epng.writeToUniqueFile(fCurrentEventDirname)
                              // );

 
    timer_pngs.addto(fStats);
  }
  */


  reco_list.add("DAQ",r);
  fOutput.add("raw",reco_list);
    
  jTPC.add("crates",jCrates);
  fOutput.add("TPC",jTPC);
  
  timer.addto(fStats);
}

uint32_t resolveFrame(uint32_t frameCourse,uint32_t frameFine, uint32_t bitmask)
{
  /// 
  /// Figure out the correct roll-over.  Given a frame number frameCourse which is usually the
  /// event readout frame, figure out which absolute frame number should be assigned to frameFine, 
  /// which contains only <bitmask> bits of specific information.
  /// eg. (0x100,0x1,0xf) resolves to 0x101, which is the nearest solution,
  /// but (0x100,0xe,0xF) resolves to 0x9e, which is closer.
  ///
  // note that modulus = bitmask + 1. E.g. bitmask=0x7 means modulus-8 arithmetic.
  // This could probably be optimized, but my brain is a little fuzzy today.
  uint32_t option1 = (frameCourse - (frameCourse & bitmask)) | (frameFine & bitmask);
  int max = (bitmask+1)/2; // This is half-way point; you should never be further than this.
  int diff = option1-frameCourse;
  if(diff >  max) return option1 - (bitmask+1);
  if(diff < -max) return option1 + (bitmask+1);
  return option1;
}


void RawRecordComposer::getPmtFromCrateCardChan(
  int icrate, int icard,int ichan, // channel input
  int& outPmt,  // pmt or optical detector number
  int& outGain, // gain of channel 1=low, 2=high
  std::string& outSpecial // special name
    )
{
  // This function is totally bogus, but it will at least give me a framework.
  (void)icrate; // unused parameter
  
  // if(icard<7) {
  //   outGain = -1;
  //   outPmt = -1;
  //   outSpecial = "";
  //   return;
  // }
  if(ichan<30) {    
    if(icard>7) outGain = 1; // low gain
    else        outGain = 2; // high gain
    outPmt = ichan;
  } 
  else {   
    outGain = -1;
    outPmt = -1;
    outSpecial = std::string("special_").append(std::to_string(ichan));
  }
  
}
  
void RawRecordComposer::composePMTs()
{
  TimeReporter timer("DAQPMTs");
  uint32_t  pmt_readout_frame_mod8  = 0xFFFFFFFF;
  uint32_t  pmt_readout_frame = 0xFFFFFFFF;
  uint32_t  pmt_readout_sample = 0xFFFFFFFF;

  JsonArray ophits;

  JsonArray jCrates;
  
  const ub_EventRecord::pmt_map_t& pmt_map = fRecord->getPMTSEBMap();
  ub_EventRecord::pmt_map_t::const_iterator crate_it;
  for( crate_it = pmt_map.begin(); crate_it != pmt_map.end(); crate_it++){
    //get the crateHeader/crateData objects
    int crate = crate_it->first;
    const pmt_crate_data_t& crate_data = crate_it->second;
    std::unique_ptr<pmt_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();
    
  
    JsonArray jCards;
    //now get the card map (for the current crate), and do a loop over all cards
    std::vector<pmt_crate_data_t::card_t> const& cards = crate_data.getCards();
    for(const pmt_crate_data_t::card_t& card_data: cards) {
      
      const pmt_crate_data_t::card_t::header_type& card_header = card_data.header();
      int card = card_data.getModule();
      
      uint32_t pmt_event_frame      = card_data.getFrame();
      uint32_t pmt_trig_frame_mod16 = card_data.getTrigFrameMod16();
      uint32_t pmt_trig_frame       = card_data.getTrigFrame(); // The resolved version, fully specified.
      uint32_t pmt_trig_sample_2MHz = card_data.getTrigSample();
      
      JsonArray jChannels;

      // Loop channels
  
      const std::vector<pmt_crate_data_t::card_t::card_channel_type>& channels = card_data.getChannels();
      for( const pmt_crate_data_t::card_t::card_channel_type& channel_data : channels) {
  
        int channel = channel_data.getChannelNumber();
        int pmt;
        int gain;
        std::string special;
        getPmtFromCrateCardChan(crate, card, channel, pmt, gain, special);
        
        int nwindows = 0;
        // Loop windows.
        const std::vector<ub_PMT_WindowData_v6>& windows = channel_data.getWindows();
        for( const ub_PMT_WindowData_v6& window_data : windows) {
          nwindows ++;
          const ub_PMT_WindowHeader_v6& window_header = window_data.header();

          int disc = window_header.getDiscriminantor();
          // if((disc&0x3)>0)      nwindows_disc++;
          // if((disc&0x4) == 0x4) nwindows_beam++;

          uint32_t frame = resolveFrame(pmt_event_frame,window_header.getFrame(),0x7);
          uint32_t sample = window_header.getSample();
          if( (pmt_readout_frame==0xFFFFFFFF) && ((disc&0x4)==4) ) {
            // Set the readout start time here.
            pmt_readout_frame_mod8  = window_header.getFrame();
            pmt_readout_frame = frame;
            pmt_readout_sample = sample;
          }
          int nsamp = window_data.data().size();
          int peaksamp = 0;
          int peakval = 0;
          ub_RawData::const_iterator it = window_data.data().begin();
          int ped = (*it)&0xfff;
          double sumw  = 0;
          double sumwx = 0;
          double sumwxx = 0;
          for(int j=0;j<nsamp;j++) {
            double val = (*it&0xfff) - ped;
            it++;
            sumw += val;
            sumwx += val*j;
            sumwxx += val*j*j;
            if(val>peakval) {peakval = val; peaksamp = j;}
          }
          if(sumw==0) sumw = 1e-9;
          double meanTime = sumwx/sumw;
          double widthTime = sqrt(fabs(sumwxx/sumw - meanTime*meanTime));
          double peakTime = ( ((frame-pmt_readout_frame)*102400.) + (peaksamp+sample-pmt_readout_sample) ) / 64e6; // 64 mhz ticks
          
        
          double pe = sumw/2;       // Crude calibration: 2 ADC/pe low gain
          if(gain==2) pe = sumw/20; // 20 ADC/pe high gain
          
          JsonObject jobj;
          jobj.add("ccc"     ,(crate*1000 + card)*1000+channel);      
          jobj.add("opDetChan"     ,pmt);
          jobj.add("opDetGain"     ,gain);          
          if(special.length()>0) 
            jobj.add("opDetSpecial"  ,special);          
          jobj.add("disc",disc);
          jobj.add("peakTime"      ,peakTime*1e9); // nanoseconds
          jobj.add("pe"            ,pe);
          jobj.add("sample", sample);
          jobj.add("frame",frame);
          ophits.add(jobj);
                    
        }
        
        JsonObject jChannel;
        jChannel.add("channel",channel);
        jChannel.add("nwindows",nwindows);
        jChannel.add("pmt",pmt);
        jChannel.add("gain",gain);
        if(special.length()) jChannel.add("special",special);
        jChannels.add(jChannel);
  
      } // loop channels
      
      JsonObject jCard;
      jCard.add("card",card);
      jCard.add("channels",jChannels);
      jCards.add(jCard);
    } // loop cards

    JsonObject jCrate;
    jCrate.add("cards",jCards);
    jCrate.add("crateNumber",crate_header->crate_number);
    jCrate.add("cardCount",crate_header->card_count);
    jCrate.add("sebSec",crate_header->local_host_time.seb_time_sec);
    jCrate.add("sebUsec",crate_header->local_host_time.seb_time_usec);
    jCrate.add("type",crate_header->crate_type);
    jCrate.add("eventNumber",crate_header->event_number);
    jCrate.add("frameNumber",crate_header->frame_number);
    jCrate.add("cardCount",crate_header->card_count);
    jCrates.add(jCrate);
    
  } // Loop PMT crates
  JsonObject reco_list;
  reco_list.add("DAQ",ophits);
  fOutput.add("ophits",reco_list);
  
  JsonObject jPMT;
  jPMT.add("crates",jCrates);   
  fOutput.add("ophits",reco_list);   
  fOutput.add("PMT",jPMT);   
  timer.addto(fStats);
}
  
