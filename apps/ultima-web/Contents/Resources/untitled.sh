#!/bin/sh

#32bit 
export PATH=/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/usr/X11/bin 
export CC="/usr/bin/gcc -arch i386" 
export CXX="/usr/bin/g++ -arch i386" 
export GCOV="/usr/bin/gcov -arch i386" 
export CPPFLAGS="-arch i386" 
export CFLAGS="-arch i386" 
export CXXFLAGS="-arch i386" 
export LDFLAGS="-arch i386" 
./configure --enable-static --disable-video-x11 --without-x --disable-video-x11 --prefix=/opt/dosbox/bin/sdl
make clean
make
make install