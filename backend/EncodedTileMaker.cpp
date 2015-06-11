
#include "EncodedTileMaker.h"
#include "TimeReporter.h"
#include "TH1D.h"
#include "boost/thread/thread.hpp"



// given an input wiremap,
// create the slew of output .pngs using crafty 
// threaded jobs

const std::vector<double> warpbins({
    -4096
  ,-2048-1024
  ,-2048
  ,-1024
  ,-(1024+512)
  ,-(1024+256)
  , -768
  ,-512
  ,-256
  ,-128
  ,-96,-64,-56
  ,-48,-44,-40,-36,-32
  ,-30,-28,-26,-24,-22,-20,-18,-16,-14,-12
  ,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1
  ,0
  ,1,2,3,4,5,6,7,8,9,10
  ,12,14,16,18,20,22,24,26,28,30
  ,32,36,40,44,48
  ,56,64,96
  ,128
  ,256
  ,512
  ,768
  ,1024
  ,1024+256
  ,1024+512
  ,2048
  ,2048+1024
  ,4096
});

void MakeEncodedTileset(JsonObject& r,
                        std::shared_ptr<wiremap_t> wireMap, 
                        size_t nwire,
                        size_t ntdc,
                        const std::string& path,
                        const std::string& url)
{
  {
    TimeReporter timer_tiles("time_to_make_tiles");
    // create tiles.

    std::cout << "Doing tile threads"<< std::endl;
    boost::thread_group tile_threads;

    EncodedTileMaker tile_plane0window1( wireMap, 0, 2399, 0,    3200   , path, url ); 
    EncodedTileMaker tile_plane0window2( wireMap, 0, 2399, 3200, 6400   , path, url ); 
    EncodedTileMaker tile_plane0window3( wireMap, 0, 2399, 6400, ntdc   , path, url ); 
    EncodedTileMaker tile_plane1window1( wireMap, 2399, 4798, 0,    3200, path, url ); 
    EncodedTileMaker tile_plane1window2( wireMap, 2399, 4798, 3200, 6400, path, url ); 
    EncodedTileMaker tile_plane1window3( wireMap, 2399, 4798, 6400, ntdc, path, url ); 
    EncodedTileMaker tile_plane2window1( wireMap, 4798, nwire, 0,    3200, path, url ); 
    EncodedTileMaker tile_plane2window2( wireMap, 4798, nwire, 3200, 6400, path, url ); 
    EncodedTileMaker tile_plane2window3( wireMap, 4798, nwire, 6400, ntdc, path, url ); 

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
  
    timer_tiles.addto(r);    
  }


  // make stats.
  {
    TimeReporter timer_stats("time_to_make_histograms");
    TH1D timeProfile("timeProfile","timeProfile",ntdc,0,ntdc);
    std::vector<TH1*> planeProfile;
    std::vector<Double_t> timeProfileData(ntdc+2,0);
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));
    // TH1D hPedAdc("hPedAdc","hPedAdc",8192,-4096,4096);
    std::vector<size_t> hPedAdc(8192,0);
    // waveform_t blank(ntdc,0);
    for(int wire=0;wire<nwire;wire++) 
    {
      wiremap_t::iterator it = wireMap->find(wire);
      if(it != wireMap->end()) {
        waveform_t& waveform = *(it->second.get());
        double wiresum = 0;
            
        for(int k=0;k<ntdc;k++) {        
          short raw = waveform[k];
          // hPedAdc->Fill(raw);
          hPedAdc[raw+4096]++;
          double val = abs(raw);
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

    TH1D hPedAdcWarped("hPedAdcWarped","hPedAdcWarped",warpbins.size()-1,&(warpbins[0]));
    for(int bin=0;bin<hPedAdc.size();bin++) {
      hPedAdcWarped.Fill(bin-4096,hPedAdc[bin]);
    }
    r.add("h_adc",TH1ToHistogram(&hPedAdcWarped));
    

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];

    timer_stats.addto(r);
    
  }
  
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

