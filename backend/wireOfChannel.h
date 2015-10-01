#ifndef WIREOFCHANNEL_H_4C0E0B48
#define WIREOFCHANNEL_H_4C0E0B48

inline void wireOfChannel(int channel, int& plane, int& wire)
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

#endif /* end of include guard: WIREOFCHANNEL_H_4C0E0B48 */

