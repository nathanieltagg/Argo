
#include "EncodedTileMaker.h"
#include "TimeReporter.h"
#include "TH1D.h"
#include "boost/thread/thread.hpp"
#include "wireOfChannel.h"


// given an input wiremap,
// create the slew of output .pngs using crafty 
// threaded jobs


void MakeLowres(JsonObject& r,
              std::shared_ptr<wiremap_t> wireMap, 
              size_t nwire,
              size_t nsamp,
              const std::string& path,
              const std::string& url,
              const std::string& options,
              bool fill_empty_space)
{
  int factor_x =10;
  int factor_y =10;
  std::shared_ptr<wiremap_t> wireMap_out(new wiremap_t);
  
  // for each output 'wire'
  //   look up the 0..factor_y wires that are input.
  //   for each output tick
  //     for each input wire
  //       for each input wire tick 0..factor_x
  //          get biggest;
  //      push onto output wire
  //  push output wire
  //  encode.

  int nwire_out = nwire/factor_y;
  int nsamp_out = nsamp/factor_x;

  // for each output 'wire'
  for(int iwire_out = 0; iwire_out<nwire_out; iwire_out++) {
    waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(nsamp_out,-4000));
    wireMap_out->insert(wiremap_t::value_type(iwire_out, waveform_ptr));
    waveform_t& waveform = *waveform_ptr;
    // for(int i=0;i<nsamp_out;i++) waveform[i] = -4000; // Initialize
    
    for(int iwire_in = iwire_out*factor_y; (iwire_in < (iwire_out+1)*factor_y) && iwire_in<nwire; iwire_in++) {
      wiremap_t::iterator it = wireMap->find(iwire_in);
      if(it != wireMap->end()) {
        waveform_t& waveform_in = *(it->second.get());
        waveform._pedwidth = waveform_in._pedwidth;
        for(int i=0;i<nsamp;i++) {
          if(waveform_in[i] > waveform[i/factor_x]) waveform[i/factor_x] = waveform_in[i];
        }
      }  
    }  
  }
  EncodedTileMaker tm(wireMap_out, 0, nwire_out, 0, nsamp_out, path, url, fill_empty_space);
  tm.process();
  JsonArray jtiles;
  JsonArray jrow;
  jrow.add(tm.json());
  jtiles.add(jrow);      
  r.add("wireimg_scale_x",factor_x);
  r.add("wireimg_scale_y",factor_y);
  r.add("wireimg_encoded_tiles",jtiles);  
}

void MakeEncodedTileset(JsonObject& r,
                        std::shared_ptr<wiremap_t> wireMap, 
                        size_t nwire,
                        size_t ntdc,
                        const std::string& path,
                        const std::string& url,
                        const std::string& options,
                        bool fill_empty_space)
{
  {
    TimeReporter timer_tiles("time_to_make_tiles");
    // create tiles.

    std::cout << "Doing tile threads."
        << "\n --storage: "  << path 
        << "\n --url:     "  << url 
        << "\n --Filling space: "  << fill_empty_space 
        << "\n --options: " << options  << std::endl;
    boost::thread_group tile_threads;
    
    typedef std::vector<EncodedTileMaker> row_t;
    typedef std::vector<row_t> table_t;
    
    table_t table;
    size_t p = options.find("_tilesize");
    if(p==std::string::npos) {
      std::cout << "Doing standard 9-tile layout." << std::endl;
      row_t row0;
      row0.push_back(EncodedTileMaker(wireMap, 0, 2399, 0,    3200   , path, url,fill_empty_space));
      row0.push_back(EncodedTileMaker(wireMap, 0, 2399, 3200, 6400   , path, url,fill_empty_space));
      row0.push_back(EncodedTileMaker(wireMap, 0, 2399, 6400, ntdc   , path, url,fill_empty_space));
      table.push_back(row0);
      row_t row1;
      row1.push_back(EncodedTileMaker(wireMap, 2399, 4798, 0,    3200, path, url,fill_empty_space));
      row1.push_back(EncodedTileMaker(wireMap, 2399, 4798, 3200, 6400, path, url,fill_empty_space));
      row1.push_back(EncodedTileMaker(wireMap, 2399, 4798, 6400, ntdc, path, url,fill_empty_space));
      table.push_back(row1);
      row_t row2;

      row2.push_back(EncodedTileMaker(wireMap, 4798, nwire, 0,    3200, path, url,fill_empty_space));
      row2.push_back(EncodedTileMaker(wireMap, 4798, nwire, 3200, 6400, path, url,fill_empty_space));
      row2.push_back(EncodedTileMaker(wireMap, 4798, nwire, 6400, ntdc, path, url,fill_empty_space));
      table.push_back(row2);
    } else {
      int tilesize = 0;
      std::istringstream ss(options.substr(p+9));
      ss >> tilesize;
      if(tilesize <= 0 || tilesize > 10000) tilesize = 2048;
      
      int rows = ceil((float)nwire/(float)tilesize);
      int cols = ceil((float)ntdc/(float)tilesize);
      std::cout << "Doing tilesize " << tilesize << " with " << rows << " x " << cols << std::endl;
      
      for(int i=0;i<rows;i++) {
        row_t row;
        for(int j=0;j<cols;j++) {
          int x1 = i*tilesize;
          int x2 = x1+tilesize;
          if(x2>nwire) x2=nwire;
          int y1 = j*tilesize;
          int y2 = y1+tilesize;
          if(y2>ntdc) y2=ntdc;
          std::cout << "tile" << x1 << " " << x2 << " " << y1 << " " << y2 << std::endl;
          row.push_back(EncodedTileMaker(wireMap, x1,x2, y1,y2, path, url,fill_empty_space));
        }
        table.push_back(row);
      }      
    }

    for(int i=0;i<table.size();i++) {
      row_t& row = table[i];
      for(int j=0;j<row.size();j++) {
        EncodedTileMaker& tilemaker = row[j];
        tile_threads.create_thread(boost::bind(&EncodedTileMaker::process,&tilemaker));
      }
    }
    tile_threads.join_all();

    std::cout << "Finished tile threads"<< std::endl;

    JsonArray jtiles;
    for(int i=0;i<table.size();i++) {
      row_t& row = table[i];
      JsonArray jrow;
      for(int j=0;j<row.size();j++) {
        EncodedTileMaker& tilemaker = row[j];
        jrow.add(tilemaker.json());
      }
      jtiles.add(jrow);      
    }
  
    r.add("wireimg_encoded_tiles",jtiles);
  
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
          // assert(raw+4096>=0);
          // assert(raw+4096<8192);
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
    

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];

    timer_stats.addto(r);
    
  }
  
  
}




